import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabaseService } from '../src/db/index.js';
import { hashToken } from '../src/utils/crypto.js';

const TEST_VAULT_STORAGE = path.resolve(process.cwd(), 'tests/scratch_vault');
const TEST_VAULT_DB = path.resolve(TEST_VAULT_STORAGE, 'vault-test.sqlite');

function cleanVaultTestDb() {
  if (fs.existsSync(TEST_VAULT_STORAGE)) {
    fs.rmSync(TEST_VAULT_STORAGE, { recursive: true, force: true });
  }
}

describe('Phase 4: Private Vault Core & Step-Up Authorization Tests', () => {
  let app: FastifyInstance;
  let authCookie: string;

  beforeEach(async () => {
    cleanVaultTestDb();
    closeDatabase();
    initDatabase(TEST_VAULT_DB);
    app = await buildApp();
    await app.ready();

    // 1. Initialize admin account
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'vaultadmin',
        password: 'MasterPassword123!',
        passwordConfirm: 'MasterPassword123!',
        vaultPassword: 'SecretVaultPass456!',
        vaultPasswordConfirm: 'SecretVaultPass456!',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const cookieHeader = initRes.headers['set-cookie'] as string;
    const match = cookieHeader.match(/auth_session=([^;]+)/);
    authCookie = match ? match[1]! : '';
  });

  afterEach(async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      closeDatabase();
      cleanVaultTestDb();
    }
  });

  it('1. GET /api/vault/status requires account authentication and reports locked initially', async () => {
    // Without account auth
    const unauthedRes = await app.inject({
      method: 'GET',
      url: '/api/vault/status',
    });
    expect(unauthedRes.statusCode).toBe(401);

    // With account auth, vault locked
    const lockedRes = await app.inject({
      method: 'GET',
      url: '/api/vault/status',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
    });
    expect(lockedRes.statusCode).toBe(200);
    const body = JSON.parse(lockedRes.body);
    expect(body.success).toBe(true);
    expect(body.data.isUnlocked).toBe(false);
    expect(body.data.remainingSeconds).toBe(0);
  });

  it('2. POST /api/vault/unlock rejects incorrect vault passphrases', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
      payload: {
        vaultPassword: 'WrongVaultPassword!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_VAULT_PASSPHRASE');
  });

  it('3. POST /api/vault/unlock succeeds with correct passphrase and sets hashed session in DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
      payload: {
        vaultPassword: 'SecretVaultPass456!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isUnlocked).toBe(true);
    expect(body.data.remainingSeconds).toBeGreaterThan(0);

    // Verify Set-Cookie
    const cookieHeader = res.headers['set-cookie'] as string;
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('vault_session=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
    expect(cookieHeader.toLowerCase()).toContain('path=/api');

    const rawVaultToken = cookieHeader.match(/vault_session=([^;]+)/)?.[1]!;
    expect(rawVaultToken).toBeDefined();

    // Verify raw token is NOT in database; only SHA-256 hash is stored
    const db = getDatabaseService().getDb();
    const expectedHash = hashToken(rawVaultToken);

    const vaultRow = db.prepare('SELECT * FROM vault_sessions WHERE vault_token_hash = ?').get(expectedHash);
    expect(vaultRow).toBeDefined();

    const rawSearch = db.prepare('SELECT * FROM vault_sessions WHERE vault_token_hash = ?').get(rawVaultToken);
    expect(rawSearch).toBeUndefined();
  });

  it('4. Server-side guard requireVaultAuth strictly protects vault endpoints', async () => {
    // 1. Unauthenticated request -> 401
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/vault/verify-access',
    });
    expect(res1.statusCode).toBe(401);

    // 2. Authenticated user without vault token -> 403 VAULT_LOCKED
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/vault/verify-access',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
    });
    expect(res2.statusCode).toBe(403);
    const body2 = JSON.parse(res2.body);
    expect(body2.error.code).toBe('VAULT_LOCKED');

    // 3. Unlock vault
    const unlockRes = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
      payload: {
        vaultPassword: 'SecretVaultPass456!',
      },
    });
    const vaultCookie = unlockRes.headers['set-cookie']?.match(/vault_session=([^;]+)/)?.[1]!;

    // 4. Request with valid vault token -> 200 OK
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/vault/verify-access',
      headers: {
        cookie: `auth_session=${authCookie}; vault_session=${vaultCookie}`,
      },
    });
    expect(res3.statusCode).toBe(200);
    const body3 = JSON.parse(res3.body);
    expect(body3.success).toBe(true);
    expect(body3.data.authorized).toBe(true);
  });

  it('5. POST /api/vault/lock immediately revokes vault session', async () => {
    // Unlock vault
    const unlockRes = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
      payload: {
        vaultPassword: 'SecretVaultPass456!',
      },
    });
    const vaultCookie = unlockRes.headers['set-cookie']?.match(/vault_session=([^;]+)/)?.[1]!;

    // Verify authorized
    const accessRes1 = await app.inject({
      method: 'GET',
      url: '/api/vault/verify-access',
      headers: {
        cookie: `auth_session=${authCookie}; vault_session=${vaultCookie}`,
      },
    });
    expect(accessRes1.statusCode).toBe(200);

    // Lock vault
    const lockRes = await app.inject({
      method: 'POST',
      url: '/api/vault/lock',
      headers: {
        cookie: `auth_session=${authCookie}; vault_session=${vaultCookie}`,
      },
    });
    expect(lockRes.statusCode).toBe(200);

    // Subsequent access is rejected with 403 VAULT_LOCKED
    const accessRes2 = await app.inject({
      method: 'GET',
      url: '/api/vault/verify-access',
      headers: {
        cookie: `auth_session=${authCookie}; vault_session=${vaultCookie}`,
      },
    });
    expect(accessRes2.statusCode).toBe(403);
  });

  it('6. Account logout cascades and destroys active vault session in SQLite', async () => {
    // Unlock vault
    const unlockRes = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
      payload: {
        vaultPassword: 'SecretVaultPass456!',
      },
    });
    const vaultCookie = unlockRes.headers['set-cookie']?.match(/vault_session=([^;]+)/)?.[1]!;
    const vaultHash = hashToken(vaultCookie);

    const db = getDatabaseService().getDb();
    expect(db.prepare('SELECT COUNT(*) as c FROM vault_sessions WHERE vault_token_hash = ?').get(vaultHash)).toEqual({ c: 1 });

    // Account logout
    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `auth_session=${authCookie}`,
      },
    });

    // Foreign key CASCADE should have deleted the vault session row automatically
    expect(db.prepare('SELECT COUNT(*) as c FROM vault_sessions WHERE vault_token_hash = ?').get(vaultHash)).toEqual({ c: 0 });
  });
});

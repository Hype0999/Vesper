import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabaseService } from '../src/db/index.js';
import { hashToken } from '../src/utils/crypto.js';

const TEST_AUTH_STORAGE = path.resolve(process.cwd(), 'tests/scratch_auth');
const TEST_AUTH_DB = path.resolve(TEST_AUTH_STORAGE, 'auth-test.sqlite');

function cleanAuthTestDb() {
  if (fs.existsSync(TEST_AUTH_STORAGE)) {
    fs.rmSync(TEST_AUTH_STORAGE, { recursive: true, force: true });
  }
}

describe('Phase 3: First-Run Setup & Authentication Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanAuthTestDb();
    closeDatabase();
    initDatabase(TEST_AUTH_DB);
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      closeDatabase();
      cleanAuthTestDb();
    }
  });


  it('1. GET /api/setup/status reports false on an uninitialized database', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/setup/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isInitialized).toBe(false);
  });

  it('2. POST /api/setup/initialize rejects if vault passphrase equals master password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'admin',
        password: 'SamePassword123!',
        passwordConfirm: 'SamePassword123!',
        vaultPassword: 'SamePassword123!',
        vaultPasswordConfirm: 'SamePassword123!',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('3. POST /api/setup/initialize creates admin, hashes passwords with Argon2id, and sets hashed session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'sysadmin',
        password: 'MasterPassword123!',
        passwordConfirm: 'MasterPassword123!',
        vaultPassword: 'VaultPassphrase456!',
        vaultPasswordConfirm: 'VaultPassphrase456!',
        appName: 'My Home Media Vault',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.username).toBe('sysadmin');

    // Verify Set-Cookie header is returned
    const cookieHeader = res.headers['set-cookie'] as string;
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('auth_session=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
    expect(cookieHeader.toLowerCase()).toContain('samesite=strict');

    // Extract raw token from cookie
    const match = cookieHeader.match(/auth_session=([^;]+)/);
    const rawToken = match ? match[1] : '';
    expect(rawToken).not.toBe('');

    // Verify database state
    const db = getDatabaseService().getDb();
    const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get('sysadmin') as {
      password_hash: string;
      vault_password_hash: string;
    };

    expect(userRow).toBeDefined();
    // Argon2id hashes start with $argon2id$
    expect(userRow.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(userRow.vault_password_hash.startsWith('$argon2id$')).toBe(true);
    expect(userRow.password_hash).not.toBe(userRow.vault_password_hash);

    // Verify raw token is NOT in database; only SHA-256 hash
    const expectedHash = hashToken(rawToken!);
    const sessionRow = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(expectedHash) as {
      token_hash: string;
      user_id: string;
    };
    expect(sessionRow).toBeDefined();

    const rawSearch = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(rawToken);
    expect(rawSearch).toBeUndefined(); // Raw token never saved!
  });

  it('4. POST /api/setup/initialize cannot be run twice (returns 403 ALREADY_INITIALIZED)', async () => {
    // Run first time
    await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'sysadmin',
        password: 'MasterPassword123!',
        passwordConfirm: 'MasterPassword123!',
        vaultPassword: 'VaultPassphrase456!',
        vaultPasswordConfirm: 'VaultPassphrase456!',
      },
    });

    // Attempt second time
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'attacker',
        password: 'AttackerPassword123!',
        passwordConfirm: 'AttackerPassword123!',
        vaultPassword: 'AttackerVault456!',
        vaultPasswordConfirm: 'AttackerVault456!',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ALREADY_INITIALIZED');
  });

  it('5. GET /api/auth/me returns profile when session cookie is provided and 401 without cookie', async () => {
    // 1. Initialize
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'sysadmin',
        password: 'MasterPassword123!',
        passwordConfirm: 'MasterPassword123!',
        vaultPassword: 'VaultPassphrase456!',
        vaultPasswordConfirm: 'VaultPassphrase456!',
      },
    });
    const cookieHeader = setupRes.headers['set-cookie'] as string;
    const rawToken = cookieHeader.match(/auth_session=([^;]+)/)?.[1];

    // 2. Request /api/auth/me with cookie
    const authedRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: `auth_session=${rawToken}`,
      },
    });

    expect(authedRes.statusCode).toBe(200);
    const authedBody = JSON.parse(authedRes.body);
    expect(authedBody.success).toBe(true);
    expect(authedBody.data.user.username).toBe('sysadmin');

    // 3. Request without cookie
    const unauthedRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(unauthedRes.statusCode).toBe(401);
  });

  it('6. POST /api/auth/login validates credentials and sets secure session', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'alice',
        password: 'CorrectPassword123!',
        passwordConfirm: 'CorrectPassword123!',
        vaultPassword: 'VaultPassword456!',
        vaultPasswordConfirm: 'VaultPassword456!',
      },
    });

    // Wrong password
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'alice',
        password: 'WrongPassword!',
      },
    });
    expect(failRes.statusCode).toBe(401);

    // Correct password
    const successRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'alice',
        password: 'CorrectPassword123!',
      },
    });
    expect(successRes.statusCode).toBe(200);
    const loginBody = JSON.parse(successRes.body);
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.user.username).toBe('alice');
    expect(successRes.headers['set-cookie']).toBeDefined();
  });

  it('7. POST /api/auth/logout deletes session from database and clears cookie', async () => {
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/setup/initialize',
      payload: {
        username: 'bob',
        password: 'MasterPassword123!',
        passwordConfirm: 'MasterPassword123!',
        vaultPassword: 'VaultPassphrase456!',
        vaultPasswordConfirm: 'VaultPassphrase456!',
      },
    });
    const cookieHeader = setupRes.headers['set-cookie'] as string;
    const rawToken = cookieHeader.match(/auth_session=([^;]+)/)?.[1];

    // Verify session in DB
    const db = getDatabaseService().getDb();
    const tokenHash = hashToken(rawToken!);
    expect(db.prepare('SELECT COUNT(*) as c FROM sessions WHERE token_hash = ?').get(tokenHash)).toEqual({ c: 1 });

    // Call logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `auth_session=${rawToken}`,
      },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Session deleted from DB
    expect(db.prepare('SELECT COUNT(*) as c FROM sessions WHERE token_hash = ?').get(tokenHash)).toEqual({ c: 0 });

    // Calling /api/auth/me now returns 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: `auth_session=${rawToken}`,
      },
    });
    expect(meRes.statusCode).toBe(401);
  });
});

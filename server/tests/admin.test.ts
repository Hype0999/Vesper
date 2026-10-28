import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabaseService } from '../src/db/index.js';

const TEST_STORAGE = path.resolve(process.cwd(), 'tests/scratch_admin');
const TEST_DB = path.resolve(TEST_STORAGE, 'admin-test.sqlite');
const TEST_MEDIA_FOLDER = path.resolve(TEST_STORAGE, 'mock_pendrive');

function cleanTestDir() {
  if (fs.existsSync(TEST_STORAGE)) {
    fs.rmSync(TEST_STORAGE, { recursive: true, force: true });
  }
}

describe('Admin Command Station, Telemetry & Drive Management', () => {
  let app: FastifyInstance;
  let request: ReturnType<typeof supertest>;
  let adminCookie: string;
  let memberCookie: string;
  let sampleMediaPath: string;

  beforeAll(async () => {
    cleanTestDir();
    fs.mkdirSync(TEST_MEDIA_FOLDER, { recursive: true });

    // Create a mock media file in the mock pendrive
    sampleMediaPath = path.join(TEST_MEDIA_FOLDER, 'vacation_song.mp3');
    fs.writeFileSync(sampleMediaPath, Buffer.from('ID3mock-audio-content-for-testing'));

    closeDatabase();
    initDatabase(TEST_DB);

    app = await buildApp();
    await app.ready();
    request = supertest(app.server);

    // Initialize admin user
    await request.post('/api/setup/initialize').send({
      username: 'masteradmin',
      password: 'AdminPassword123!',
      passwordConfirm: 'AdminPassword123!',
      vaultPassword: 'AdminVault123!',
      vaultPasswordConfirm: 'AdminVault123!',
    });

    // Login admin
    const adminLoginRes = await request.post('/api/auth/login').send({
      username: 'masteradmin',
      password: 'AdminPassword123!',
    });
    const adminSetCookie = adminLoginRes.headers['set-cookie'];
    adminCookie = Array.isArray(adminSetCookie) ? adminSetCookie[0] : (adminSetCookie as string);

    // Create and login regular member user
    await request
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        username: 'companion_user',
        password: 'UserPassword123!',
        role: 'member',
      });

    const memberLoginRes = await request.post('/api/auth/login').send({
      username: 'companion_user',
      password: 'UserPassword123!',
    });
    const memberSetCookie = memberLoginRes.headers['set-cookie'];
    memberCookie = Array.isArray(memberSetCookie) ? memberSetCookie[0] : (memberSetCookie as string);
  });

  afterAll(async () => {
    await app.close();
    closeDatabase();
    cleanTestDir();
  });

  it('1. Rejects unauthenticated requests to admin endpoints with 401', async () => {
    const res = await request.get('/api/admin/telemetry');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Rejects non-admin users with 403 Forbidden', async () => {
    const res = await request
      .get('/api/admin/telemetry')
      .set('Cookie', memberCookie);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. Allows admin to retrieve full system telemetry and hardware metrics', async () => {
    const res = await request
      .get('/api/admin/telemetry')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.system).toBeDefined();
    expect(res.body.data.system.hardware).toBeDefined();
    expect(res.body.data.activeSessionsCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.mediaStats).toBeDefined();
    expect(res.body.data.storage).toBeDefined();
  });

  it('4. Allows admin to query connected storage drives', async () => {
    const res = await request
      .get('/api/admin/drives')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.drives)).toBe(true);
  });

  it('5. Allows admin to scan a folder/pendrive and discovers media files', async () => {
    const res = await request
      .post('/api/admin/drives/scan')
      .set('Cookie', adminCookie)
      .send({ drivePath: TEST_MEDIA_FOLDER });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scan.mediaFiles.length).toBe(1);
    expect(res.body.data.scan.mediaFiles[0].fileName).toBe('vacation_song.mp3');
    expect(res.body.data.scan.mediaFiles[0].type).toBe('audio');
    expect(res.body.data.scan.summary.audioCount).toBe(1);
  });

  it('6. Ingests discovered media into Public Sanctuary (unlocked)', async () => {
    const res = await request
      .post('/api/admin/drives/ingest')
      .set('Cookie', adminCookie)
      .send({
        filePaths: [sampleMediaPath],
        isPrivate: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.importedCount).toBe(1);
    expect(res.body.data.result.items[0].status).toBe('success');
  });

  it('7. Ingests discovered media into Private Encrypted Vault (locked at rest)', async () => {
    const privateSongPath = path.join(TEST_MEDIA_FOLDER, 'secret_audio.flac');
    fs.writeFileSync(privateSongPath, Buffer.from('fLaCmock-private-audio-stream'));

    const res = await request
      .post('/api/admin/drives/ingest')
      .set('Cookie', adminCookie)
      .send({
        filePaths: [privateSongPath],
        isPrivate: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.importedCount).toBe(1);

    // Verify in db that is_private is 1
    const db = getDatabaseService().getDb();
    const row = db.prepare('SELECT is_private, storage_path FROM media WHERE title = ?').get('secret_audio') as any;
    expect(row).toBeDefined();
    expect(row.is_private).toBe(1);
    expect(row.storage_path.endsWith('.enc')).toBe(true);
  });

  it('8. Allows admin to clear temporary cache', async () => {
    const res = await request
      .post('/api/admin/cache/clear')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.clearedBytes).toBe('number');
  });
});

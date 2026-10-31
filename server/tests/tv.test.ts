import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDatabase, closeDatabase, getDatabaseService } from '../src/db/index.js';
import { HdmiTvService } from '../src/services/hdmi-tv.service.js';

const TEST_STORAGE = path.resolve(process.cwd(), 'tests/scratch_tv');
const TEST_DB = path.resolve(TEST_STORAGE, 'tv-test.sqlite');

function cleanTestDir() {
  if (fs.existsSync(TEST_STORAGE)) {
    fs.rmSync(TEST_STORAGE, { recursive: true, force: true });
  }
}

describe('Auto HDMI TV Connect & Remote Control System Tests', () => {
  let app: FastifyInstance;
  let request: ReturnType<typeof supertest>;
  let adminCookie: string;
  let testMediaId: string;

  beforeAll(async () => {
    cleanTestDir();
    fs.mkdirSync(TEST_STORAGE, { recursive: true });

    closeDatabase();
    initDatabase(TEST_DB);

    app = await buildApp();
    await app.ready();
    request = supertest(app.server);

    // Initialize admin user
    await request.post('/api/setup/initialize').send({
      username: 'tvmasteradmin',
      password: 'AdminPassword123!',
      passwordConfirm: 'AdminPassword123!',
      vaultPassword: 'AdminVault123!',
      vaultPasswordConfirm: 'AdminVault123!',
      appName: 'Vesper Sanctuary',
    });

    const loginRes = await request.post('/api/auth/login').send({
      username: 'tvmasteradmin',
      password: 'AdminPassword123!',
    });

    const rawCookies = loginRes.headers['set-cookie'];
    adminCookie = Array.isArray(rawCookies) ? rawCookies[0] : (rawCookies as string);

    // Find the created user ID
    const db = getDatabaseService().getDb();
    const userRow = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string };

    // Insert a test media row
    testMediaId = 'test-tv-movie-1';
    db.prepare(`
      INSERT OR REPLACE INTO media (
        id, user_id, type, sub_type, title, description, category_id, is_private,
        storage_path, thumbnail_path, file_size, mime_type, original_filename,
        file_extension, width, height, duration, play_count, is_favorite, created_at, updated_at
      ) VALUES (
        ?, ?, 'video', 'movie', 'Inception 4K Direct', 'Cinema masterpiece', NULL, 0,
        '/tmp/inception.mp4', NULL, 1048576, 'video/mp4', 'inception.mp4',
        '.mp4', 3840, 2160, 8880, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(testMediaId, userRow.id);
  });

  afterAll(async () => {
    HdmiTvService.getInstance().destroy();
    await app.close();
    closeDatabase();
    cleanTestDir();
  });

  it('1. GET /api/tv/status returns HDMI status and playback state', async () => {
    const res = await request
      .get('/api/tv/status')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('hdmi');
    expect(res.body.data).toHaveProperty('playback');
    expect(typeof res.body.data.hdmi.connected).toBe('boolean');
    expect(res.body.data.playback.playbackState).toBe('idle');
  });

  it('2. POST /api/tv/remote accepts directional, playback, and volume actions', async () => {
    const actions = ['up', 'down', 'left', 'right', 'select', 'play_pause', 'volume_up', 'back'] as const;

    for (const action of actions) {
      const res = await request
        .post('/api/tv/remote')
        .set('Cookie', adminCookie)
        .send({ action });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.command.action).toBe(action);
      expect(res.body.data.command.source).toBe('phone_remote');
    }
  });

  it('3. POST /api/tv/cast casts media to TV display with live state sync', async () => {
    const res = await request
      .post('/api/tv/cast')
      .set('Cookie', adminCookie)
      .send({
        mediaId: testMediaId,
        startTime: 42,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.casted).toBe(true);
    expect(res.body.data.status.playback.playbackState).toBe('playing');
    expect(res.body.data.status.playback.currentTime).toBe(42);
    expect(res.body.data.status.playback.currentMedia?.title).toBe('Inception 4K Direct');
  });

  it('4. POST /api/tv/playback-state updates TV player progress', async () => {
    const res = await request
      .post('/api/tv/playback-state')
      .send({
        playbackState: 'playing',
        currentTime: 120,
        duration: 8880,
        volume: 95,
        isMuted: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.playback.currentTime).toBe(120);
    expect(res.body.data.playback.volume).toBe(95);
  });

  it('5. POST /api/tv/simulate allows admin to toggle HDMI hardware detection', async () => {
    const connectRes = await request
      .post('/api/tv/simulate')
      .set('Cookie', adminCookie)
      .send({ connected: true });

    expect(connectRes.status).toBe(200);
    expect(connectRes.body.success).toBe(true);
    expect(connectRes.body.data.hdmi.connected).toBe(true);

    const disconnectRes = await request
      .post('/api/tv/simulate')
      .set('Cookie', adminCookie)
      .send({ connected: false });

    expect(disconnectRes.status).toBe(200);
    expect(disconnectRes.body.data.hdmi.connected).toBe(false);
  });
});

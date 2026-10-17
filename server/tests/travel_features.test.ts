import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/index.js';

const TEST_TRAVEL_STORAGE = path.resolve(process.cwd(), 'tests/scratch_travel');
const TEST_TRAVEL_DB = path.resolve(TEST_TRAVEL_STORAGE, 'travel-test.sqlite');

function cleanTravelTestDb() {
  if (fs.existsSync(TEST_TRAVEL_STORAGE)) {
    fs.rmSync(TEST_TRAVEL_STORAGE, { recursive: true, force: true });
  }
}

describe('Travel Hub Capabilities: Audio, Network & Multi-User Tests', () => {
  let app: FastifyInstance;
  let request: ReturnType<typeof supertest>;
  let authCookie: string;

  beforeAll(async () => {
    cleanTravelTestDb();
    closeDatabase();
    initDatabase(TEST_TRAVEL_DB);

    app = await buildApp();
    await app.ready();
    request = supertest(app.server);

    await request.post('/api/setup/initialize').send({
      username: 'traveladmin',
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      vaultPassword: 'VaultPassphrase123!',
      vaultPasswordConfirm: 'VaultPassphrase123!',
    });

    const loginRes = await request.post('/api/auth/login').send({
      username: 'traveladmin',
      password: 'Password123!',
    });
    const setCookie = loginRes.headers['set-cookie'];
    authCookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
  });

  afterAll(async () => {
    await app.close();
    closeDatabase();
    cleanTravelTestDb();
  });

  it('1. Network status reports IP, .local mDNS domain, and connection state', async () => {
    const res = await request
      .get('/api/network/status')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.status.ipAddress).toBeDefined();
    expect(res.body.data.status.localDomain).toContain('.local');
  });

  it('2. Network Wi-Fi scan discovers available wireless access points', async () => {
    const res = await request
      .get('/api/network/scan')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.networks)).toBe(true);
  });

  it('3. Multi-User: Lists accounts and allows creating travel companion user', async () => {
    // List users
    const listRes = await request
      .get('/api/users')
      .set('Cookie', authCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data.users)).toBe(true);

    const companionUsername = `companion_${Date.now()}`;
    const createRes = await request
      .post('/api/users')
      .set('Cookie', authCookie)
      .send({
        username: companionUsername,
        password: 'CompanionPass123!',
        role: 'member',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.user.username).toBe(companionUsername);
  });

  it('4. Audio Upload & High-Fidelity Streaming: saves audio track and supports Range stream', async () => {
    // Create a temporary mock mp3 file in scratch
    const tmpAudioPath = path.resolve(process.cwd(), 'tests/test_track.mp3');
    fs.writeFileSync(tmpAudioPath, Buffer.from('ID3MockAudioBytesForRangeStreamingTestContent'));

    const uploadRes = await request
      .post('/api/media/upload')
      .set('Cookie', authCookie)
      .field('title', 'Train Journey Chill Beats')
      .field('description', 'High bitrate audio for train travel')
      .attach('file', tmpAudioPath);

    try { fs.unlinkSync(tmpAudioPath); } catch { /* ignore */ }

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    const media = uploadRes.body.data.media;
    expect(media.type).toBe('audio');
    expect(media.title).toBe('Train Journey Chill Beats');

    // Test HEAD request for fast metadata probing
    const headRes = await request
      .head(`/api/media/${media.id}/stream`)
      .set('Cookie', authCookie);

    expect(headRes.status).toBe(200);
    expect(headRes.headers['accept-ranges']).toBe('bytes');

    // Test Range request (RFC 7233 partial content)
    const rangeRes = await request
      .get(`/api/media/${media.id}/stream`)
      .set('Cookie', authCookie)
      .set('Range', 'bytes=0-15');

    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers['content-range']).toMatch(/^bytes 0-15\//);
  });
});

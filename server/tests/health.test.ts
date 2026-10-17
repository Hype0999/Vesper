import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { closeDatabase } from '../src/db/index.js';
import { SystemHealthSchema } from '@media-hub/shared';

describe('Server Foundation & Health API Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    closeDatabase();
  });


  it('GET /api/system/health returns 200 with valid schema structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Validate against shared Zod schema
    const validation = SystemHealthSchema.safeParse(body.data);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.status).toBe('ok');
      expect(validation.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(validation.data.version).toBe('0.1.0');
      expect(validation.data.database.status).toBe('ok');
      expect(validation.data.database.migrationVersion).toBeGreaterThanOrEqual(1);
    }
  });


  it('Enforces security headers on responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('Blocks state-modifying requests with disallowed Origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/system/health',
      headers: {
        origin: 'https://malicious-attacker-site.com',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('Returns structured JSON 404 envelope for nonexistent API endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/nonexistent-route',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

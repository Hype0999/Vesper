import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { SetupInitializeSchema, type ApiResponse, type SetupStatus, type UserProfile } from '@media-hub/shared';
import { getDatabaseService } from '../db/index.js';
import { hashPassword, generateSecureToken, hashToken } from '../utils/crypto.js';
import { env } from '../config/env.js';

export const setupRoutes: FastifyPluginAsync = async (fastify) => {
  // Check if system setup is complete
  fastify.get('/status', async (_request, reply) => {
    const db = getDatabaseService().getDb();
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    const appNameRow = db.prepare("SELECT value FROM system_settings WHERE key = 'app_name'").get() as
      | { value: string }
      | undefined;

    const data: SetupStatus = {
      isInitialized: userCount > 0,
      appName: appNameRow?.value ?? 'Nest',
    };

    return reply.send({ success: true, data } satisfies ApiResponse<SetupStatus>);
  });

  // Execute 10-step atomic first-run initialization
  fastify.post('/initialize', async (request, reply) => {
    const parseResult = SetupInitializeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message ?? 'Invalid setup configuration input',
          details: parseResult.error.format(),
        },
      });
    }

    const { username, password, vaultPassword, appName } = parseResult.data;
    const dbService = getDatabaseService();
    const db = dbService.getDb();

    // Check if already initialized before expensive Argon2 hashing
    const initialCheck = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    if (initialCheck > 0) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'ALREADY_INITIALIZED',
          message: 'System is already initialized. First-time setup cannot be repeated.',
        },
      });
    }

    // Compute Argon2id hashes for master account and private vault
    const passwordHash = await hashPassword(password);
    const vaultPasswordHash = await hashPassword(vaultPassword);

    const userId = crypto.randomUUID();
    const rawSessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    try {
      dbService.runInTransaction((database) => {
        // Double-check inside transaction with write lock
        const lockedCount = (database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
        if (lockedCount > 0) {
          throw new Error('ALREADY_INITIALIZED');
        }

        // 1. Create primary admin user
        database
          .prepare(
            `
          INSERT INTO users (id, username, password_hash, vault_password_hash)
          VALUES (?, ?, ?, ?)
        `,
          )
          .run(userId, username, passwordHash, vaultPasswordHash);

        // 2. Persist system settings
        database
          .prepare(
            `
          INSERT OR REPLACE INTO system_settings (key, value, updated_at)
          VALUES ('is_initialized', 'true', CURRENT_TIMESTAMP)
        `,
          )
          .run();

        const finalAppName = appName?.trim() || 'Nest';
        database
          .prepare(
            `
          INSERT OR REPLACE INTO system_settings (key, value, updated_at)
          VALUES ('app_name', ?, CURRENT_TIMESTAMP)
        `,
          )
          .run(finalAppName);

        // 3. Issue initial active session
        database
          .prepare(
            `
          INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `,
          )
          .run(sessionTokenHash, userId, request.headers['user-agent'] ?? 'unknown', request.ip, expiresAt);
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_INITIALIZED') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ALREADY_INITIALIZED',
            message: 'System is already initialized. First-time setup cannot be repeated.',
          },
        });
      }
      throw err;
    }

    // Set secure session cookie
    void reply.setCookie('auth_session', rawSessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProduction,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const userProfile: UserProfile = {
      id: userId,
      username,
    };

    return reply.status(201).send({
      success: true,
      data: { user: userProfile },
    });
  });
};

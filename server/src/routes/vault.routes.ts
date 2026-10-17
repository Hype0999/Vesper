import type { FastifyPluginAsync } from 'fastify';
import { VaultUnlockSchema, type ApiResponse, type VaultStatus } from '@media-hub/shared';
import { authenticateUser } from '../middleware/auth.js';
import { requireVaultAuth } from '../middleware/vault-auth.js';
import { getDatabaseService } from '../db/index.js';
import { verifyPassword, generateSecureToken, hashToken } from '../utils/crypto.js';
import { env } from '../config/env.js';

export const vaultRoutes: FastifyPluginAsync = async (fastify) => {
  // Check private vault unlock status
  fastify.get('/status', { preHandler: authenticateUser }, async (request, reply) => {
    const rawVaultToken = request.cookies['vault_session'];

    if (!rawVaultToken || !request.sessionTokenHash || !request.user) {
      return reply.send({
        success: true,
        data: { isUnlocked: false, remainingSeconds: 0 },
      } satisfies ApiResponse<VaultStatus>);
    }

    const vaultTokenHash = hashToken(rawVaultToken);
    const db = getDatabaseService().getDb();

    interface Row {
      expires_at: string;
    }

    const row = db
      .prepare(
        `
      SELECT expires_at
      FROM vault_sessions
      WHERE vault_token_hash = ? AND session_token_hash = ? AND user_id = ?
    `,
      )
      .get(vaultTokenHash, request.sessionTokenHash, request.user.id) as Row | undefined;

    if (!row) {
      void reply.clearCookie('vault_session', { path: '/api' });
      return reply.send({
        success: true,
        data: { isUnlocked: false, remainingSeconds: 0 },
      } satisfies ApiResponse<VaultStatus>);
    }

    const now = Date.now();
    const expiresAtMs = new Date(row.expires_at).getTime();

    if (now > expiresAtMs) {
      db.prepare('DELETE FROM vault_sessions WHERE vault_token_hash = ?').run(vaultTokenHash);
      void reply.clearCookie('vault_session', { path: '/api' });
      return reply.send({
        success: true,
        data: { isUnlocked: false, remainingSeconds: 0 },
      } satisfies ApiResponse<VaultStatus>);
    }

    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

    return reply.send({
      success: true,
      data: { isUnlocked: true, remainingSeconds },
    } satisfies ApiResponse<VaultStatus>);
  });

  // Step-up unlock authorization using vault passphrase
  fastify.post('/unlock', { preHandler: authenticateUser }, async (request, reply) => {
    const parseResult = VaultUnlockSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Vault passphrase is required.',
        },
      });
    }

    const { vaultPassword } = parseResult.data;
    const userId = request.user!.id;
    const sessionTokenHash = request.sessionTokenHash!;
    const db = getDatabaseService().getDb();

    interface UserVaultRow {
      vault_password_hash: string;
    }

    const user = db
      .prepare('SELECT vault_password_hash FROM users WHERE id = ?')
      .get(userId) as UserVaultRow | undefined;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account not found.',
        },
      });
    }

    const isValid = await verifyPassword(user.vault_password_hash, vaultPassword);
    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_VAULT_PASSPHRASE',
          message: 'Incorrect vault passphrase.',
        },
      });
    }

    // Issue 15-minute sliding vault session token
    const rawVaultToken = generateSecureToken(32);
    const vaultTokenHash = hashToken(rawVaultToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.transaction(() => {
      // Clean up previous vault sessions for this web session if any
      db.prepare('DELETE FROM vault_sessions WHERE session_token_hash = ?').run(sessionTokenHash);

      // Insert new vault session
      db.prepare(
        `
        INSERT INTO vault_sessions (vault_token_hash, session_token_hash, user_id, expires_at)
        VALUES (?, ?, ?, ?)
      `,
      ).run(vaultTokenHash, sessionTokenHash, userId, expiresAt);
    })();

    // Set short-lived HttpOnly cookie scoped to /api
    void reply.setCookie('vault_session', rawVaultToken, {
      path: '/api',
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProduction,
      maxAge: 15 * 60, // 15 minutes
    });

    return reply.send({
      success: true,
      data: {
        isUnlocked: true,
        remainingSeconds: 15 * 60,
      },
    } satisfies ApiResponse<VaultStatus>);
  });

  // Lock vault immediately (zero-delay server-side invalidation)
  fastify.post('/lock', { preHandler: authenticateUser }, async (request, reply) => {
    const rawVaultToken = request.cookies['vault_session'];
    if (rawVaultToken) {
      const vaultTokenHash = hashToken(rawVaultToken);
      const db = getDatabaseService().getDb();
      db.prepare('DELETE FROM vault_sessions WHERE vault_token_hash = ?').run(vaultTokenHash);
    }

    void reply.clearCookie('vault_session', { path: '/api' });

    return reply.send({
      success: true,
      data: { isUnlocked: false, remainingSeconds: 0 },
    } satisfies ApiResponse<VaultStatus>);
  });

  // Dedicated endpoint to verify server-side vault guard enforcement
  fastify.get('/verify-access', { preHandler: requireVaultAuth }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        authorized: true,
        message: 'Private Vault step-up authorization successfully verified.',
      },
    });
  });
};

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiErrorResponse } from '@media-hub/shared';
import { authenticateUser } from './auth.js';
import { hashToken } from '../utils/crypto.js';
import { getDatabaseService } from '../db/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    isVaultAuthorized?: boolean;
  }
}

export async function requireVaultAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. First enforce master account authentication
  await authenticateUser(request, reply);
  if (reply.sent) {
    return;
  }

  const rawVaultToken = request.cookies['vault_session'];

  if (!rawVaultToken) {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'VAULT_LOCKED',
        message: 'Private Vault is locked. Step-up authorization required.',
      },
    } satisfies ApiErrorResponse);
  }

  const vaultTokenHash = hashToken(rawVaultToken);
  const sessionTokenHash = request.sessionTokenHash;
  const userId = request.user?.id;

  if (!sessionTokenHash || !userId) {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'VAULT_LOCKED',
        message: 'Invalid session context for vault access.',
      },
    } satisfies ApiErrorResponse);
  }

  const db = getDatabaseService().getDb();

  interface VaultSessionRow {
    vault_token_hash: string;
    session_token_hash: string;
    user_id: string;
    expires_at: string;
  }

  const row = db
    .prepare(
      `
      SELECT vault_token_hash, session_token_hash, user_id, expires_at
      FROM vault_sessions
      WHERE vault_token_hash = ? AND session_token_hash = ? AND user_id = ?
    `,
    )
    .get(vaultTokenHash, sessionTokenHash, userId) as VaultSessionRow | undefined;

  if (!row) {
    void reply.clearCookie('vault_session', { path: '/api' });
    return reply.status(403).send({
      success: false,
      error: {
        code: 'VAULT_LOCKED',
        message: 'Vault authorization is invalid or expired. Please unlock the vault again.',
      },
    } satisfies ApiErrorResponse);
  }

  const now = new Date();
  const expiresAt = new Date(row.expires_at);

  if (now > expiresAt) {
    // Expired vault session: delete and clear
    db.prepare('DELETE FROM vault_sessions WHERE vault_token_hash = ?').run(vaultTokenHash);
    void reply.clearCookie('vault_session', { path: '/api' });
    return reply.status(403).send({
      success: false,
      error: {
        code: 'VAULT_EXPIRED',
        message: 'Vault access has expired due to inactivity. Please unlock the vault again.',
      },
    } satisfies ApiErrorResponse);
  }

  // 2. Sliding window TTL extension (15 minutes from now)
  const extendedExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE vault_sessions SET expires_at = ? WHERE vault_token_hash = ?').run(extendedExpiry, vaultTokenHash);

  request.isVaultAuthorized = true;
}

export function checkVaultAuth(request: FastifyRequest): boolean {
  const rawVaultToken = request.cookies['vault_session'];
  if (!rawVaultToken) return false;

  const sessionTokenHash = request.sessionTokenHash;
  const userId = request.user?.id;
  if (!sessionTokenHash || !userId) return false;

  const vaultTokenHash = hashToken(rawVaultToken);
  const db = getDatabaseService().getDb();

  const row = db
    .prepare(
      `SELECT expires_at FROM vault_sessions WHERE vault_token_hash = ? AND session_token_hash = ? AND user_id = ?`,
    )
    .get(vaultTokenHash, sessionTokenHash, userId) as { expires_at: string } | undefined;

  if (!row) return false;
  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  if (now > expiresAt) {
    db.prepare('DELETE FROM vault_sessions WHERE vault_token_hash = ?').run(vaultTokenHash);
    return false;
  }

  // Extend sliding expiry
  const extendedExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE vault_sessions SET expires_at = ? WHERE vault_token_hash = ?').run(extendedExpiry, vaultTokenHash);
  return true;
}


import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiErrorResponse, UserProfile } from '@media-hub/shared';
import { hashToken } from '../utils/crypto.js';
import { getDatabaseService } from '../db/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserProfile;
    sessionTokenHash?: string;
  }
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawToken = request.cookies['auth_session'];

  if (!rawToken) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      },
    } satisfies ApiErrorResponse);
  }

  const tokenHash = hashToken(rawToken);
  const db = getDatabaseService().getDb();

  interface SessionRow {
    token_hash: string;
    user_id: string;
    expires_at: string;
    id: string;
    username: string;
    role?: 'admin' | 'member' | 'guest';
  }

  const row = db
    .prepare(
      `
      SELECT s.token_hash, s.user_id, s.expires_at, u.id, u.username, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ?
    `,
    )
    .get(tokenHash) as SessionRow | undefined;

  if (!row) {
    void reply.clearCookie('auth_session', { path: '/' });
    return reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Invalid or revoked session. Please log in again.',
      },
    } satisfies ApiErrorResponse);
  }

  const now = new Date();
  const expiresAt = new Date(row.expires_at);

  if (now > expiresAt) {
    // Session expired: purge and clear cookie
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    void reply.clearCookie('auth_session', { path: '/' });
    return reply.status(401).send({
      success: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session has expired. Please log in again.',
      },
    } satisfies ApiErrorResponse);
  }

  // Update last_active
  db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE token_hash = ?').run(tokenHash);

  // Attach user context to request
  request.user = {
    id: row.id,
    username: row.username,
    role: (row.role as 'admin' | 'member' | 'guest') || 'admin',
  };
  request.sessionTokenHash = row.token_hash;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticateUser(request, reply);
  if (reply.sent) return;
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrative privileges required for this action.',
      },
    } satisfies ApiErrorResponse);
  }
}

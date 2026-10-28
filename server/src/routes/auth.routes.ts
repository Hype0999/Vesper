import type { FastifyPluginAsync } from 'fastify';
import { LoginSchema, type ApiResponse, type UserProfile } from '@media-hub/shared';
import { getDatabaseService } from '../db/index.js';
import { verifyPassword, generateSecureToken, hashToken } from '../utils/crypto.js';
import { authenticateUser } from '../middleware/auth.js';
import { env } from '../config/env.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login with master account credentials
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and password are required',
        },
      });
    }

    const { username, password } = parseResult.data;
    const db = getDatabaseService().getDb();

    interface UserRow {
      id: string;
      username: string;
      password_hash: string;
      role?: 'admin' | 'member' | 'guest';
    }

    const user = db
      .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as UserRow | undefined;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    // Issue new secure session
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.prepare(
      `
      INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(tokenHash, user.id, request.headers['user-agent'] ?? 'unknown', request.ip, expiresAt);

    // Set secure HttpOnly cookie
    void reply.setCookie('auth_session', rawToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProduction,
      maxAge: 7 * 24 * 60 * 60,
    });

    const userProfile: UserProfile = {
      id: user.id,
      username: user.username,
      role: user.role ?? 'admin',
    };

    return reply.send({
      success: true,
      data: { user: userProfile },
    } satisfies ApiResponse<{ user: UserProfile }>);
  });

  // Terminate active session
  fastify.post('/logout', async (request, reply) => {
    const rawToken = request.cookies['auth_session'];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const db = getDatabaseService().getDb();
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }

    void reply.clearCookie('auth_session', { path: '/' });

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  // Retrieve authenticated user profile
  fastify.get('/me', { preHandler: authenticateUser }, async (request, reply) => {
    return reply.send({
      success: true,
      data: { user: request.user! },
    } satisfies ApiResponse<{ user: UserProfile }>);
  });
};

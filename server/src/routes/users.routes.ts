import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { authenticateUser } from '../middleware/auth.js';
import { getDatabaseService } from '../db/index.js';
import { hashPassword } from '../utils/crypto.js';
import { CreateUserSchema, type UserProfile } from '@media-hub/shared';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateUser);

  // 1. List all user accounts
  fastify.get('/', async (_request, reply) => {
    const db = getDatabaseService().getDb();
    interface UserRow {
      id: string;
      username: string;
      role: string;
      created_at: string;
    }

    const rows = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all() as UserRow[];

    return reply.send({
      success: true,
      data: {
        users: rows.map((r) => ({
          id: r.id,
          username: r.username,
          role: (r.role as 'admin' | 'member' | 'guest') || 'member',
          createdAt: r.created_at,
        })),
      },
    });
  });

  // 2. Create new user account (Multi-User support for travel companions/guests)
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message ?? 'Invalid user data',
        },
      });
    }

    const { username, password, role, vaultPassword } = parseResult.data;
    const db = getDatabaseService().getDb();

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'USER_EXISTS', message: `User "${username}" already exists` },
      });
    }

    const passwordHash = await hashPassword(password);
    const vaultPasswordHash = await hashPassword(vaultPassword || password);
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, vault_password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newId, username, passwordHash, vaultPasswordHash, role, now, now);

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: newId,
          username,
          role,
        } as UserProfile,
      },
    });
  });

  // 3. Delete user account
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const targetId = request.params.id;
    if (targetId === request.user?.id) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own active account' },
      });
    }

    const db = getDatabaseService().getDb();
    const totalAdmins = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }).count;
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(targetId) as { role: string } | undefined;

    if (!targetUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    if (targetUser.role === 'admin' && totalAdmins <= 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'LAST_ADMIN', message: 'Cannot delete the only admin account' },
      });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

    return reply.send({
      success: true,
      data: { message: 'User deleted successfully' },
    });
  });
};

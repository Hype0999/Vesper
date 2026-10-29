import type { FastifyPluginAsync } from 'fastify';
import { authenticateUser, requireWriteAccess } from '../middleware/auth.js';
import { checkVaultAuth } from '../middleware/vault-auth.js';
import { getNotesService } from '../services/notes.service.js';
import type { ApiResponse, NoteItem } from '@media-hub/shared';

export const notesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateUser);
  const notesService = getNotesService();

  // 1. List notes
  fastify.get<{
    Querystring: {
      categoryId?: string;
      vaultOnly?: string;
      search?: string;
    };
  }>('/', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const { categoryId, vaultOnly, search } = request.query;

    const notes = await notesService.getNotesList({
      userId: request.user!.id,
      categoryId,
      isVaultUnlocked,
      vaultOnly: vaultOnly === 'true' || vaultOnly === '1',
      search,
    });

    return reply.send({
      success: true,
      data: { notes, isVaultUnlocked },
    });
  });

  // 2. Get single note
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const note = await notesService.getNoteById(request.params.id, request.user!.id, isVaultUnlocked);

    if (!note) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found or vault locked' },
      });
    }

    return reply.send({
      success: true,
      data: { note },
    });
  });

  // 3. Create note (Member/Admin only)
  fastify.post<{
    Body: {
      title: string;
      content: string;
      categoryId?: string;
      isPrivate?: boolean;
      tags?: string[];
    };
  }>('/', { preHandler: requireWriteAccess }, async (request, reply) => {
    const { title, content, categoryId, isPrivate, tags } = request.body || {};

    if (!title || !title.trim()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Note title is required' },
      });
    }

    if (isPrivate && !checkVaultAuth(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'VAULT_LOCKED', message: 'Vault is locked. Unlock vault to create private notes.' },
      });
    }

    const note = await notesService.createNote({
      userId: request.user!.id,
      title: title.trim(),
      content: content || '',
      categoryId,
      isPrivate: !!isPrivate,
      tags,
    });

    return reply.status(201).send({
      success: true,
      data: { note },
    } satisfies ApiResponse<{ note: NoteItem }>);
  });

  // 4. Update note (Member/Admin only)
  fastify.put<{
    Params: { id: string };
    Body: {
      title?: string;
      content?: string;
      categoryId?: string | null;
      isFavorite?: boolean;
      isPinned?: boolean;
    };
  }>('/:id', { preHandler: requireWriteAccess }, async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const updated = await notesService.updateNote(
      request.params.id,
      request.user!.id,
      request.body || {},
      isVaultUnlocked
    );

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found or vault locked' },
      });
    }

    return reply.send({
      success: true,
      data: { note: updated },
    });
  });

  // 5. Delete note (Member/Admin only)
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireWriteAccess }, async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const success = await notesService.deleteNote(request.params.id, request.user!.id, isVaultUnlocked);

    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found or could not be deleted' },
      });
    }

    return reply.send({ success: true });
  });
};

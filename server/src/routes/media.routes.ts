import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { authenticateUser } from '../middleware/auth.js';
import { checkVaultAuth } from '../middleware/vault-auth.js';
import { getMediaService } from '../services/media.service.js';
import { VaultCipher } from '../utils/vault-cipher.js';
import type { ApiResponse, MediaItem, MediaType } from '@media-hub/shared';

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  // All media operations require authentication
  fastify.addHook('preHandler', authenticateUser);

  const mediaService = getMediaService();

  // 1. Upload Media (Streaming Multipart)
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    const fields = data.fields as Record<string, { value: string } | undefined>;
    const query = (request.query || {}) as Record<string, string | undefined>;
    const title = fields['title']?.value?.trim() || query.title?.trim() || data.filename;
    const description = fields['description']?.value?.trim() || query.description?.trim() || '';
    const categoryId = fields['categoryId']?.value?.trim() || query.categoryId?.trim() || undefined;
    const isPrivate = fields['isPrivate']?.value === 'true' || fields['isPrivate']?.value === '1' || query.isPrivate === 'true' || query.isPrivate === '1';
    const tagsStr = fields['tags']?.value?.trim() || query.tags?.trim();
    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

    // If uploading private media, check that vault is unlocked
    if (isPrivate && !checkVaultAuth(request)) {
      // Drain stream to prevent connection hanging
      data.file.resume();
      return reply.status(403).send({
        success: false,
        error: {
          code: 'VAULT_LOCKED',
          message: 'Vault is locked. Unlock the private vault before uploading private media.',
        },
      });
    }

    try {
      const mediaItem = await mediaService.saveMediaFile({
        userId: request.user!.id,
        fileStream: data.file,
        originalFilename: data.filename,
        mimeType: data.mimetype,
        title,
        description,
        categoryId,
        isPrivate,
        tags,
      });

      return reply.status(201).send({
        success: true,
        data: { media: mediaItem },
      } satisfies ApiResponse<{ media: MediaItem }>);
    } catch (err) {
      request.log.error({ err }, 'Error saving uploaded media');
      return reply.status(500).send({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'Failed to process and store media file' },
      });
    }
  });

  // 2. List Media
  fastify.get<{
    Querystring: {
      type?: MediaType;
      categoryId?: string;
      vaultOnly?: string;
      search?: string;
    };
  }>('/', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const { type, categoryId, vaultOnly, search } = request.query;

    const mediaList = await mediaService.getMediaList({
      userId: request.user!.id,
      type,
      categoryId,
      isVaultUnlocked,
      vaultOnly: vaultOnly === 'true' || vaultOnly === '1',
      search,
    });

    return reply.send({
      success: true,
      data: { media: mediaList, isVaultUnlocked },
    });
  });

  // 3. Get Media Metadata
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const media = await mediaService.getMediaById(request.params.id, request.user!.id, isVaultUnlocked);

    if (!media) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Media item not found or locked' },
      });
    }

    return reply.send({
      success: true,
      data: { media },
    });
  });

  // 4. Stream Media with RFC 7233 Range Support (Optimized for 4K / High Bitrate Direct Play)
  fastify.route<{ Params: { id: string } }>({
    method: ['GET', 'HEAD'],
    url: '/:id/stream',
    handler: async (request, reply) => {
      const isVaultUnlocked = checkVaultAuth(request);
      const fileInfo = mediaService.getMediaFilePath(request.params.id, request.user!.id, isVaultUnlocked);

      if (!fileInfo) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Media stream not found or access denied' },
        });
      }

      const { filePath, mimeType, fileSize, isPrivate } = fileInfo;
      const range = request.headers.range;

      // Cache control
      if (isPrivate) {
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        reply.header('Pragma', 'no-cache');
      } else {
        reply.header('Cache-Control', 'private, max-age=3600');
      }

      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', 'inline');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0] || '0', 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          reply.header('Content-Range', `bytes */${fileSize}`);
          return reply.status(416).send();
        }

        const chunksize = end - start + 1;
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunksize);

        if (request.method === 'HEAD') {
          return reply.send();
        }

        if (fileInfo.isEncrypted) {
          const { stream } = VaultCipher.createDecryptionStream(filePath, start, end, fileSize);
          return reply.send(stream);
        } else {
          // 512KB buffer for ultra-smooth 4K 60fps high bitrate streaming
          const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 512 * 1024 });
          return reply.send(stream);
        }
      } else {
        reply.header('Content-Length', fileSize);

        if (request.method === 'HEAD') {
          return reply.send();
        }

        if (fileInfo.isEncrypted) {
          const { stream } = VaultCipher.createDecryptionStream(filePath, 0, fileSize - 1, fileSize);
          return reply.send(stream);
        } else {
          const stream = fs.createReadStream(filePath, { highWaterMark: 512 * 1024 });
          return reply.send(stream);
        }
      }
    },
  });

  // 5. Get Thumbnail
  fastify.get<{ Params: { id: string } }>('/:id/thumbnail', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const thumbInfo = mediaService.getThumbnailPath(request.params.id, request.user!.id, isVaultUnlocked);

    if (!thumbInfo) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Thumbnail not found' },
      });
    }

    if (thumbInfo.isPrivate) {
      reply.header('Cache-Control', 'no-store, private');
    } else {
      reply.header('Cache-Control', 'public, max-age=86400');
    }

    const lowerThumb = thumbInfo.thumbPath.toLowerCase();
    const mime = lowerThumb.includes('.jpg') || lowerThumb.includes('.jpeg')
      ? 'image/jpeg'
      : lowerThumb.includes('.png')
      ? 'image/png'
      : 'image/webp';
    reply.header('Content-Type', mime);
    if (thumbInfo.isEncrypted) {
      const encBuf = fs.readFileSync(thumbInfo.thumbPath);
      const decBuf = VaultCipher.decryptBuffer(encBuf);
      return reply.send(decBuf);
    } else {
      const stream = fs.createReadStream(thumbInfo.thumbPath);
      return reply.send(stream);
    }
  });

  // 6. Delete Media
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const isVaultUnlocked = checkVaultAuth(request);
    const success = await mediaService.deleteMedia(request.params.id, request.user!.id, isVaultUnlocked);

    if (!success) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Media item not found or could not be deleted' },
      });
    }

    return reply.send({ success: true });
  });

  // 7. Save Playback Progress
  fastify.post<{
    Params: { id: string };
    Body: { positionSeconds: number; durationSeconds: number };
  }>('/:id/progress', async (request, reply) => {
    const { positionSeconds, durationSeconds } = request.body || {};
    if (typeof positionSeconds === 'number' && typeof durationSeconds === 'number') {
      mediaService.savePlaybackProgress(request.user!.id, request.params.id, positionSeconds, durationSeconds);
    }
    return reply.send({ success: true });
  });
};

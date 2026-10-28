import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { AdminService } from '../services/admin.service.js';
import type {
  ApiResponse,
  AdminTelemetry,
  ConnectedDrive,
  DriveScanResult,
  MediaIngestResult,
} from '@media-hub/shared';

const ScanDriveSchema = z.object({
  drivePath: z.string().trim().min(1, 'Target drive or folder path is required'),
});

const IngestMediaSchema = z.object({
  filePaths: z.array(z.string().trim()).min(1, 'At least one file must be selected for ingestion'),
  isPrivate: z.boolean().default(false),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const adminService = new AdminService();

  // All admin routes require admin privileges
  fastify.addHook('preHandler', requireAdmin);

  // 1. Get real-time system telemetry and health metrics
  fastify.get('/telemetry', async (_request, reply) => {
    try {
      const telemetry = await adminService.getAdminTelemetry();
      return reply.send({
        success: true,
        data: telemetry,
      } satisfies ApiResponse<AdminTelemetry>);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TELEMETRY_ERROR',
          message: err?.message || 'Failed to retrieve admin telemetry',
        },
      } satisfies ApiResponse<never>);
    }
  });

  // 2. Discover connected USB flash drives / external media
  fastify.get('/drives', async (_request, reply) => {
    try {
      const drives = await adminService.getConnectedDrives();
      return reply.send({
        success: true,
        data: { drives },
      } satisfies ApiResponse<{ drives: ConnectedDrive[] }>);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DRIVE_DETECTION_ERROR',
          message: err?.message || 'Failed to detect connected storage devices',
        },
      } satisfies ApiResponse<never>);
    }
  });

  // 3. Scan a drive or directory for media files
  fastify.post('/drives/scan', async (request, reply) => {
    const parse = ScanDriveSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parse.error.errors[0]?.message || 'Invalid scan parameters',
        },
      } satisfies ApiResponse<never>);
    }

    try {
      const scanResult = await adminService.scanPathForMedia(parse.data.drivePath);
      return reply.send({
        success: true,
        data: { scan: scanResult },
      } satisfies ApiResponse<{ scan: DriveScanResult }>);
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'SCAN_ERROR',
          message: err?.message || 'Failed to scan selected drive path',
        },
      } satisfies ApiResponse<never>);
    }
  });

  // 4. Batch ingest discovered files into Public Sanctuary or Private Vault
  fastify.post('/drives/ingest', async (request, reply) => {
    const parse = IngestMediaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parse.error.errors[0]?.message || 'Invalid ingestion parameters',
        },
      } satisfies ApiResponse<never>);
    }

    try {
      const result = await adminService.ingestDiscoveredFiles({
        filePaths: parse.data.filePaths,
        isPrivate: parse.data.isPrivate,
        userId: request.user!.id,
        categoryId: parse.data.categoryId,
        tags: parse.data.tags,
      });

      return reply.send({
        success: true,
        data: { result },
      } satisfies ApiResponse<{ result: MediaIngestResult }>);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INGESTION_ERROR',
          message: err?.message || 'Media ingestion process failed',
        },
      } satisfies ApiResponse<never>);
    }
  });

  // 5. Clear temporary transcoding cache
  fastify.post('/cache/clear', async (_request, reply) => {
    try {
      const res = await adminService.clearTempCache();
      return reply.send({
        success: true,
        data: res,
      } satisfies ApiResponse<{ clearedBytes: number; filesRemoved: number }>);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CACHE_CLEAR_ERROR',
          message: err?.message || 'Failed to clear temporary cache',
        },
      } satisfies ApiResponse<never>);
    }
  });
};

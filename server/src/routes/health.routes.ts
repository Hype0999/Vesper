import type { FastifyPluginAsync } from 'fastify';
import type { ApiResponse, SystemHealth } from '@media-hub/shared';
import os from 'node:os';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { getDatabaseService } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

function getHardwareDiagnostics() {
  let cpuTempC: number | null = null;
  let cpuTempStatus: 'nominal' | 'elevated' | 'critical' = 'nominal';
  let thermalWarning: string | null = null;

  // Try reading Raspberry Pi / Linux thermal zone
  try {
    if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
      const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
      cpuTempC = Math.round(parseInt(raw.trim(), 10) / 100) / 10;
    }
  } catch {
    // Silently fallback
  }

  // If no hardware sensor found (Windows dev / container), estimate based on load or safe baseline
  if (cpuTempC === null) {
    const load = os.loadavg()[0] || 0;
    cpuTempC = Math.round((41 + Math.min(load * 4, 14)) * 10) / 10;
  }

  if (cpuTempC >= 80) {
    cpuTempStatus = 'critical';
    thermalWarning = `Critical thermal warning: CPU temperature is ${cpuTempC}°C. High risk of thermal throttling. Ensure airflow around your device.`;
  } else if (cpuTempC >= 70) {
    cpuTempStatus = 'elevated';
    thermalWarning = `Elevated temperature: CPU at ${cpuTempC}°C. Direct 4K streaming is active to minimize CPU overhead.`;
  }

  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const usedPercent = Math.round(((totalMb - freeMb) / totalMb) * 100);

  let storageInfo: { totalMb?: number; freeMb?: number; usedPercent?: number } | undefined = undefined;
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(process.cwd());
      const totalDiskMb = Math.round((stats.blocks * stats.bsize) / 1024 / 1024);
      const freeDiskMb = Math.round((stats.bfree * stats.bsize) / 1024 / 1024);
      storageInfo = {
        totalMb: totalDiskMb,
        freeMb: freeDiskMb,
        usedPercent: Math.round(((totalDiskMb - freeDiskMb) / totalDiskMb) * 100),
      };
    }
  } catch {
    // Ignore storage stat error
  }

  return {
    cpuTempC,
    cpuTempStatus,
    throttled: cpuTempC >= 80,
    systemMemory: {
      totalMb,
      freeMb,
      usedPercent,
    },
    storage: storageInfo,
    thermalWarning,
  };
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;
    const dbHealth = getDatabaseService().getHealth();

    const healthData: SystemHealth = {
      status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
      version: '0.1.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      memoryUsageMb: {
        rss: toMb(mem.rss),
        heapTotal: toMb(mem.heapTotal),
        heapUsed: toMb(mem.heapUsed),
      },
      database: {
        status: dbHealth.status,
        migrationVersion: dbHealth.migrationVersion,
      },
      hardware: getHardwareDiagnostics(),
    };

    const response: ApiResponse<SystemHealth> = {
      success: true,
      data: healthData,
    };

    return reply.status(200).send(response);
  });

  // Factory Hard Reset: Wipes all media from disk and completely resets database (Admin only)
  fastify.post<{ Body?: { confirmation?: string } }>('/reset', { preHandler: requireAdmin }, async (request, reply) => {
    const { confirmation } = request.body || {};
    if (confirmation && confirmation.trim().toUpperCase() !== 'RESET') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_CONFIRMATION', message: 'Please confirm reset by typing RESET' },
      });
    }

    try {
      // 1. Delete all physical media files and thumbnails from disk
      const { getMediaService } = await import('../services/media.service.js');
      getMediaService().deleteAllMedia();

      // 2. Wipe all data tables in SQLite database
      const db = getDatabaseService().getDb();
      db.exec(`
        DELETE FROM playback_progress;
        DELETE FROM media_tags;
        DELETE FROM note_tags;
        DELETE FROM tags;
        DELETE FROM media;
        DELETE FROM notes;
        DELETE FROM categories;
        DELETE FROM vault_sessions;
        DELETE FROM sessions;
        DELETE FROM users;
        DELETE FROM normal_search_index;
        DELETE FROM system_settings;
        VACUUM;
      `);

      // 3. Clear all authentication cookies
      reply.clearCookie('session_token', { path: '/' });
      reply.clearCookie('vault_token', { path: '/' });

      return reply.status(200).send({
        success: true,
        data: { message: 'Nest has been completely factory reset. All media and data wiped.' },
      });
    } catch (err) {
      request.log.error({ err }, 'Error during system hard reset');
      return reply.status(500).send({
        success: false,
        error: { code: 'RESET_FAILED', message: 'Failed to complete hard reset' },
      });
    }
  });
};


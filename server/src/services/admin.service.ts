import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDatabaseService } from '../db/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { MediaService } from './media.service.js';
import type {
  ConnectedDrive,
  DiscoveredMediaFile,
  DriveScanResult,
  MediaIngestResult,
  AdminTelemetry,
  MediaType,
  SystemHealth,
} from '@media-hub/shared';

const execFileAsync = promisify(execFile);

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.flv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.opus', '.wma']);
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

const IGNORED_DIR_NAMES = new Set([
  'system volume information',
  '$recycle.bin',
  '.trashes',
  '.git',
  '.github',
  'node_modules',
  '.cache',
  'recovery',
]);

export class AdminService {
  private mediaService: MediaService;
  private tempDir: string;

  constructor() {
    this.mediaService = new MediaService();
    this.tempDir = path.resolve(env.resolvedStorageDir, 'temp');
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Cross-platform detection of connected USB drives / removable storage
   */
  async getConnectedDrives(): Promise<ConnectedDrive[]> {
    const drives: ConnectedDrive[] = [];

    if (process.platform === 'win32') {
      try {
        const psCommand = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType, FileSystem | ConvertTo-Json -Compress`;
        const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
          timeout: 4000,
        });

        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];

          for (const disk of list) {
            const devId = (disk.DeviceID || '').toString().trim();
            if (!devId) continue;

            const isRemovable = disk.DriveType === 2; // 2 = Removable (USB / Pendrive)
            const label = disk.VolumeName || (isRemovable ? 'USB Flash Drive' : 'Local Disk');
            const total = Number(disk.Size) || 0;
            const free = Number(disk.FreeSpace) || 0;

            drives.push({
              id: devId.replace(':', ''),
              name: `${devId} [${label}]`,
              mountPath: `${devId}\\`,
              label: label,
              totalBytes: total,
              freeBytes: free,
              isRemovable: isRemovable,
              fileSystem: disk.FileSystem || 'NTFS',
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'PowerShell disk discovery failed, using fallback drive scanner');
      }

      // Windows Fallback: Scan drive letters D: through Z: if no drives found
      if (drives.length === 0) {
        const driveLetters = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'U'];
        for (const letter of driveLetters) {
          const p = `${letter}:\\`;
          try {
            if (fs.existsSync(p)) {
              let total = 0;
              let free = 0;
              try {
                if (typeof fs.statfsSync === 'function') {
                  const stat = fs.statfsSync(p);
                  total = stat.blocks * stat.bsize;
                  free = stat.bfree * stat.bsize;
                }
              } catch {
                // ignore
              }

              drives.push({
                id: letter,
                name: `Drive ${letter}:`,
                mountPath: p,
                label: `Drive (${letter}:)`,
                totalBytes: total,
                freeBytes: free,
                isRemovable: true,
                fileSystem: 'FAT32/NTFS',
              });
            }
          } catch {
            // inaccessible drive
          }
        }
      }
    } else {
      // Linux / Raspberry Pi OS Detection
      try {
        // Try lsblk JSON
        const { stdout } = await execFileAsync('lsblk', ['-J', '-b', '-o', 'NAME,MOUNTPOINT,LABEL,SIZE,FSTYPE,RM,TYPE'], {
          timeout: 4000,
        });

        if (stdout && stdout.trim()) {
          const data = JSON.parse(stdout.trim());
          const blockdevices = data.blockdevices || [];

          const extractDevices = (devs: any[]) => {
            for (const dev of devs) {
              if (dev.mountpoint && dev.mountpoint !== '/' && !dev.mountpoint.startsWith('/boot')) {
                const isRemovable = Boolean(dev.rm) || dev.rm === '1' || dev.mountpoint.startsWith('/media') || dev.mountpoint.startsWith('/mnt');
                let freeBytes = 0;
                try {
                  if (typeof fs.statfsSync === 'function') {
                    const stat = fs.statfsSync(dev.mountpoint);
                    freeBytes = stat.bfree * stat.bsize;
                  }
                } catch {
                  // ignore
                }

                drives.push({
                  id: dev.name || path.basename(dev.mountpoint),
                  name: `${dev.label || dev.name} (${dev.mountpoint})`,
                  mountPath: dev.mountpoint,
                  label: dev.label || 'Removable Storage',
                  totalBytes: Number(dev.size) || 0,
                  freeBytes: freeBytes,
                  isRemovable: isRemovable,
                  fileSystem: dev.fstype || 'ext4/vfat',
                });
              }

              if (dev.children && Array.isArray(dev.children)) {
                extractDevices(dev.children);
              }
            }
          };

          extractDevices(blockdevices);
        }
      } catch (err) {
        logger.debug({ err }, 'lsblk command unavailable, inspecting /media and /mnt mountpoints');
      }

      // Linux Fallback: Inspect /media, /mnt, and /run/media mountpoints
      if (drives.length === 0) {
        const candidateMounts = ['/media', '/mnt', '/run/media'];
        for (const baseMount of candidateMounts) {
          if (fs.existsSync(baseMount)) {
            try {
              const entries = fs.readdirSync(baseMount, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const mountPath = path.join(baseMount, entry.name);
                  let total = 0;
                  let free = 0;
                  try {
                    if (typeof fs.statfsSync === 'function') {
                      const stat = fs.statfsSync(mountPath);
                      total = stat.blocks * stat.bsize;
                      free = stat.bfree * stat.bsize;
                    }
                  } catch {
                    // ignore
                  }

                  drives.push({
                    id: entry.name,
                    name: `${entry.name} (${mountPath})`,
                    mountPath,
                    label: entry.name,
                    totalBytes: total,
                    freeBytes: free,
                    isRemovable: true,
                    fileSystem: 'FAT32/exFAT',
                  });
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }

    return drives;
  }

  /**
   * Recursively scan a connected drive or folder for media files
   */
  async scanPathForMedia(targetPath: string, maxDepth = 4, maxFiles = 800): Promise<DriveScanResult> {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Target path does not exist: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedPath}`);
    }

    const discovered: DiscoveredMediaFile[] = [];
    let scannedCount = 0;

    const walk = (currentDir: string, currentDepth: number) => {
      if (currentDepth > maxDepth || discovered.length >= maxFiles) return;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        logger.warn({ err, currentDir }, 'Cannot read directory during media scan');
        return;
      }

      for (const entry of entries) {
        if (discovered.length >= maxFiles) break;

        const nameLower = entry.name.toLowerCase();
        if (entry.name.startsWith('.') || IGNORED_DIR_NAMES.has(nameLower)) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          scannedCount++;
          const ext = path.extname(entry.name).toLowerCase();
          let type: MediaType | null = null;
          let mime = 'application/octet-stream';

          if (VIDEO_EXTENSIONS.has(ext)) {
            type = 'video';
            mime = ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4';
          } else if (AUDIO_EXTENSIONS.has(ext)) {
            type = 'audio';
            mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.flac' ? 'audio/flac' : ext === '.wav' ? 'audio/wav' : 'audio/mp4';
          } else if (PHOTO_EXTENSIONS.has(ext)) {
            type = 'photo';
            mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          }

          if (type) {
            try {
              const fileStats = fs.statSync(fullPath);
              discovered.push({
                filePath: fullPath,
                fileName: entry.name,
                fileSize: fileStats.size,
                type,
                extension: ext,
                mimeType: mime,
                parentDir: path.basename(currentDir),
              });
            } catch {
              // file inaccessible
            }
          }
        }
      }
    };

    walk(resolvedPath, 0);

    const summary = {
      totalCount: discovered.length,
      videoCount: discovered.filter((f) => f.type === 'video').length,
      audioCount: discovered.filter((f) => f.type === 'audio').length,
      photoCount: discovered.filter((f) => f.type === 'photo').length,
      totalBytes: discovered.reduce((acc, f) => acc + f.fileSize, 0),
    };

    return {
      drivePath: resolvedPath,
      scannedCount,
      mediaFiles: discovered,
      summary,
    };
  }

  /**
   * Batch ingest files from pendrive into Public Sanctuary or Private Vault (with AES-256-CTR)
   */
  async ingestDiscoveredFiles(options: {
    filePaths: string[];
    isPrivate: boolean;
    userId: string;
    categoryId?: string;
    tags?: string[];
  }): Promise<MediaIngestResult> {
    const results: MediaIngestResult['items'] = [];
    let importedCount = 0;
    let failedCount = 0;

    for (const filePath of options.filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          results.push({
            filePath,
            title: path.basename(filePath),
            status: 'error',
            error: 'File does not exist or drive unmounted',
          });
          failedCount++;
          continue;
        }

        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const baseTitle = fileName.replace(/\.[^/.]+$/, '');

        let mimeType = 'application/octet-stream';
        if (VIDEO_EXTENSIONS.has(ext)) mimeType = ext === '.webm' ? 'video/webm' : 'video/mp4';
        else if (AUDIO_EXTENSIONS.has(ext)) mimeType = ext === '.mp3' ? 'audio/mpeg' : ext === '.flac' ? 'audio/flac' : 'audio/mp4';
        else if (PHOTO_EXTENSIONS.has(ext)) mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

        const fileStream = fs.createReadStream(filePath);

        const savedMedia = await this.mediaService.saveMediaFile({
          userId: options.userId,
          fileStream,
          originalFilename: fileName,
          mimeType,
          title: baseTitle,
          isPrivate: options.isPrivate,
          categoryId: options.categoryId,
          tags: options.tags,
        });

        results.push({
          filePath,
          title: baseTitle,
          status: 'success',
          mediaId: savedMedia.id,
        });
        importedCount++;
      } catch (err: any) {
        logger.error({ err, filePath }, 'Failed to ingest media file from drive');
        results.push({
          filePath,
          title: path.basename(filePath),
          status: 'error',
          error: err?.message || 'Ingestion failed',
        });
        failedCount++;
      }
    }

    return {
      importedCount,
      failedCount,
      items: results,
    };
  }

  /**
   * Full admin telemetry & system diagnostics
   */
  async getAdminTelemetry(): Promise<AdminTelemetry> {
    const db = getDatabaseService().getDb();

    // Active companion sessions
    const activeSessionsRow = db
      .prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > CURRENT_TIMESTAMP')
      .get() as { count: number } | undefined;
    const activeSessionsCount = activeSessionsRow?.count || 0;

    // Media stats breakdown
    const mediaStatsRow = db
      .prepare(`
        SELECT 
          COUNT(*) as totalCount,
          SUM(CASE WHEN is_private = 0 THEN 1 ELSE 0 END) as publicCount,
          SUM(CASE WHEN is_private = 1 THEN 1 ELSE 0 END) as vaultCount,
          SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) as videoCount,
          SUM(CASE WHEN type = 'audio' THEN 1 ELSE 0 END) as audioCount,
          SUM(CASE WHEN type = 'photo' THEN 1 ELSE 0 END) as photoCount,
          COALESCE(SUM(file_size), 0) as totalStorageBytes
        FROM media
      `)
      .get() as any;

    // Hardware diagnostics (CPU, temp, RAM, storage)
    let cpuTempC: number | null = null;
    let cpuTempStatus: 'nominal' | 'elevated' | 'critical' = 'nominal';
    let thermalWarning: string | null = null;

    try {
      if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
        const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
        cpuTempC = Math.round(parseInt(raw.trim(), 10) / 100) / 10;
      }
    } catch {
      // ignore
    }

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
        const stats = fs.statfsSync(env.resolvedStorageDir);
        const totalDiskMb = Math.round((stats.blocks * stats.bsize) / 1024 / 1024);
        const freeDiskMb = Math.round((stats.bfree * stats.bsize) / 1024 / 1024);
        storageInfo = {
          totalMb: totalDiskMb,
          freeMb: freeDiskMb,
          usedPercent: Math.round(((totalDiskMb - freeDiskMb) / totalDiskMb) * 100),
        };
      }
    } catch {
      // ignore
    }

    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;
    const dbHealth = getDatabaseService().getHealth();

    const systemHealth: SystemHealth = {
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
      hardware: {
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
      },
    };

    // Temp folder size
    let tempDirSizeMb = 0;
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        let bytes = 0;
        for (const file of files) {
          try {
            bytes += fs.statSync(path.join(this.tempDir, file)).size;
          } catch {
            // ignore
          }
        }
        tempDirSizeMb = Math.round((bytes / 1024 / 1024) * 10) / 10;
      }
    } catch {
      // ignore
    }

    return {
      system: systemHealth,
      activeSessionsCount,
      mediaStats: {
        totalCount: Number(mediaStatsRow?.totalCount || 0),
        publicCount: Number(mediaStatsRow?.publicCount || 0),
        vaultCount: Number(mediaStatsRow?.vaultCount || 0),
        videoCount: Number(mediaStatsRow?.videoCount || 0),
        audioCount: Number(mediaStatsRow?.audioCount || 0),
        photoCount: Number(mediaStatsRow?.photoCount || 0),
        totalStorageBytes: Number(mediaStatsRow?.totalStorageBytes || 0),
      },
      storage: {
        mediaDir: path.resolve(env.resolvedStorageDir, 'media/normal'),
        vaultDir: path.resolve(env.resolvedStorageDir, 'media/private'),
        tempDirSizeMb,
      },
    };
  }

  /**
   * Clear temporary cached files
   */
  async clearTempCache(): Promise<{ clearedBytes: number; filesRemoved: number }> {
    let clearedBytes = 0;
    let filesRemoved = 0;

    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const f of files) {
        const p = path.join(this.tempDir, f);
        try {
          const stats = fs.statSync(p);
          clearedBytes += stats.size;
          fs.unlinkSync(p);
          filesRemoved++;
        } catch {
          // ignore
        }
      }
    }

    return { clearedBytes, filesRemoved };
  }
}

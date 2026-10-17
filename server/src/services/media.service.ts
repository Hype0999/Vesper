import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { getDatabaseService } from '../db/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { VaultCipher } from '../utils/vault-cipher.js';
import type { MediaItem, MediaType } from '@media-hub/shared';

export class MediaService {
  private mediaNormalDir: string;
  private mediaPrivateDir: string;
  private thumbNormalDir: string;
  private thumbPrivateDir: string;

  constructor() {
    this.mediaNormalDir = path.resolve(env.resolvedStorageDir, 'media/normal');
    this.mediaPrivateDir = path.resolve(env.resolvedStorageDir, 'media/private');
    this.thumbNormalDir = path.resolve(env.resolvedStorageDir, 'thumbnails/normal');
    this.thumbPrivateDir = path.resolve(env.resolvedStorageDir, 'thumbnails/private');

    // Ensure all directories exist
    for (const dir of [
      this.mediaNormalDir,
      this.mediaPrivateDir,
      this.thumbNormalDir,
      this.thumbPrivateDir,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async saveMediaFile(options: {
    userId: string;
    fileStream: NodeJS.ReadableStream;
    originalFilename: string;
    mimeType: string;
    title: string;
    description?: string;
    categoryId?: string;
    isPrivate: boolean;
    tags?: string[];
  }): Promise<MediaItem> {
    const mediaId = crypto.randomUUID();
    const ext = path.extname(options.originalFilename).toLowerCase() || '.bin';
    const isVideo = options.mimeType.startsWith('video/') || ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].includes(ext);
    const isAudio = options.mimeType.startsWith('audio/') || ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.opus', '.wma'].includes(ext);
    let mediaType: MediaType = 'photo';
    if (isVideo) mediaType = 'video';
    else if (isAudio) mediaType = 'audio';

    let resolvedMime = options.mimeType;
    if (isAudio && (!resolvedMime || resolvedMime === 'application/octet-stream')) {
      if (ext === '.mp3') resolvedMime = 'audio/mpeg';
      else if (ext === '.m4a' || ext === '.aac') resolvedMime = 'audio/mp4';
      else if (ext === '.flac') resolvedMime = 'audio/flac';
      else if (ext === '.wav') resolvedMime = 'audio/wav';
      else if (ext === '.ogg' || ext === '.opus') resolvedMime = 'audio/ogg';
    }

    const targetMediaDir = options.isPrivate ? this.mediaPrivateDir : this.mediaNormalDir;
    const targetThumbDir = options.isPrivate ? this.thumbPrivateDir : this.thumbNormalDir;

    const storedFilename = `${mediaId}${ext}`;
    const filePath = path.join(targetMediaDir, storedFilename);
    const thumbFilename = `${mediaId}.webp`;
    const thumbPath = path.join(targetThumbDir, thumbFilename);

    // Write file to disk
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(options.fileStream, writeStream);

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    let width: number | null = null;
    let height: number | null = null;
    let duration: number | null = null;
    let hasThumbnail = false;

    // Generate thumbnail / artwork
    if (mediaType === 'photo') {
      try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;

        await image
          .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(thumbPath);
        hasThumbnail = true;
      } catch (err) {
        logger.warn({ err, mediaId }, 'Failed to generate photo thumbnail with sharp');
      }
    } else if (mediaType === 'audio') {
      try {
        const ffmpegModule = await import('@ffmpeg-installer/ffmpeg');
        const ffmpegPath = ffmpegModule.default.path || (ffmpegModule as unknown as { path: string }).path;
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);

        const tempArtworkPath = path.join(targetThumbDir, `temp_art_${mediaId}.jpg`);
        let extracted = false;
        try {
          await execFileAsync(ffmpegPath, [
            '-y',
            '-i', filePath,
            '-an',
            '-vcodec', 'copy',
            tempArtworkPath,
          ]);
          if (fs.existsSync(tempArtworkPath) && fs.statSync(tempArtworkPath).size > 100) {
            await sharp(tempArtworkPath)
              .resize(480, 480, { fit: 'cover' })
              .webp({ quality: 85 })
              .toFile(thumbPath);
            extracted = true;
            hasThumbnail = true;
          }
        } catch {
          // No embedded album cover in audio stream
        } finally {
          if (fs.existsSync(tempArtworkPath)) {
            try { fs.unlinkSync(tempArtworkPath); } catch { /* ignore */ }
          }
        }

        if (!extracted) {
          const sanitizedTitle = (options.title || options.originalFilename)
            .replace(/<[^>]*>?/gm, '')
            .replace(/[&"']/g, '')
            .slice(0, 30);
          const svgAudioCover = `
            <svg width="480" height="480" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0f172a"/>
                  <stop offset="50%" stop-color="#090d16"/>
                  <stop offset="100%" stop-color="#022c22"/>
                </linearGradient>
                <linearGradient id="discGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#1e293b"/>
                  <stop offset="100%" stop-color="#0f172a"/>
                </linearGradient>
                <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#10b981"/>
                  <stop offset="100%" stop-color="#059669"/>
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#bgGrad)"/>
              <circle cx="240" cy="200" r="140" fill="url(#discGrad)" stroke="#334155" stroke-width="3"/>
              <circle cx="240" cy="200" r="110" fill="none" stroke="#1e293b" stroke-width="2"/>
              <circle cx="240" cy="200" r="80" fill="none" stroke="#1e293b" stroke-width="2"/>
              <circle cx="240" cy="200" r="50" fill="url(#accentGrad)"/>
              <circle cx="240" cy="200" r="16" fill="#020617"/>
              <text x="240" y="380" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="22" fill="#ffffff" text-anchor="middle">
                ${sanitizedTitle}
              </text>
              <text x="240" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#10b981" text-anchor="middle" letter-spacing="3">
                LOSSLESS AUDIO
              </text>
            </svg>
          `;
          await sharp(Buffer.from(svgAudioCover)).webp({ quality: 85 }).toFile(thumbPath);
          hasThumbnail = true;
        }
      } catch (err) {
        logger.warn({ err, mediaId }, 'Failed to create audio artwork thumbnail');
      }
    } else {
      // For video: Extract real frame thumbnail using FFmpeg
      try {
        const ffmpegModule = await import('@ffmpeg-installer/ffmpeg');
        const ffmpegPath = ffmpegModule.default.path || (ffmpegModule as unknown as { path: string }).path;
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);

        try {
          await execFileAsync(ffmpegPath, [
            '-y',
            '-ss', '00:00:01',
            '-i', filePath,
            '-vframes', '1',
            '-vf', 'scale=480:270:force_original_aspect_ratio=increase,crop=480:270',
            thumbPath,
          ]);
        } catch {
          await execFileAsync(ffmpegPath, [
            '-y',
            '-ss', '00:00:00',
            '-i', filePath,
            '-vframes', '1',
            '-vf', 'scale=480:270:force_original_aspect_ratio=increase,crop=480:270',
            thumbPath,
          ]);
        }
        hasThumbnail = fs.existsSync(thumbPath);
      } catch (err) {
        logger.warn({ err, mediaId }, 'FFmpeg frame extraction failed, generating fallback thumbnail');
        try {
          const svgPoster = `
            <svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#0a0c10"/>
              <circle cx="240" cy="135" r="32" fill="rgba(255,0,0,0.8)"/>
              <polygon points="234,122 254,135 234,148" fill="#ffffff"/>
              <text x="240" y="195" font-family="sans-serif" font-size="14" fill="#9ea3ae" text-anchor="middle">
                ${options.title.replace(/<[^>]*>?/gm, '').slice(0, 30)}
              </text>
            </svg>
          `;
          await sharp(Buffer.from(svgPoster)).webp().toFile(thumbPath);
          hasThumbnail = true;
        } catch (e) {
          logger.warn({ err: e, mediaId }, 'Failed to create fallback thumbnail');
        }
      }
    }

    const db = getDatabaseService().getDb();
    const now = new Date().toISOString();

    let finalStoredPath = filePath;
    let finalThumbPath = hasThumbnail ? thumbPath : null;

    if (options.isPrivate) {
      // Physical pendrive theft protection:
      // Encrypt file on disk using AES-256-CTR and delete unencrypted file
      try {
        const encFilePath = filePath + '.enc';
        await VaultCipher.encryptFileStream(fs.createReadStream(filePath), encFilePath);
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        finalStoredPath = encFilePath;
      } catch (err) {
        logger.error({ err, mediaId }, 'Failed to encrypt private media at rest');
      }

      if (hasThumbnail && fs.existsSync(thumbPath)) {
        try {
          const thumbBuf = fs.readFileSync(thumbPath);
          const encThumbBuf = VaultCipher.encryptBuffer(thumbBuf);
          const encThumbPath = thumbPath + '.enc';
          fs.writeFileSync(encThumbPath, encThumbBuf);
          try { fs.unlinkSync(thumbPath); } catch { /* ignore */ }
          finalThumbPath = encThumbPath;
        } catch (err) {
          logger.error({ err, mediaId }, 'Failed to encrypt private thumbnail at rest');
        }
      }
    }

    const insertMedia = db.prepare(`
      INSERT INTO media (
        id, user_id, type, title, description, category_id, is_private,
        storage_path, thumbnail_path, file_size, mime_type, original_filename,
        file_extension, width, height, duration, play_count, is_favorite,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 0, 0,
        ?, ?
      )
    `);

    insertMedia.run(
      mediaId,
      options.userId,
      mediaType,
      options.title,
      options.description ?? null,
      options.categoryId ?? null,
      options.isPrivate ? 1 : 0,
      finalStoredPath,
      finalThumbPath,
      fileSize,
      resolvedMime,
      options.originalFilename,
      ext,
      width,
      height,
      duration,
      now,
      now
    );

    // Tags handling
    if (options.tags && options.tags.length > 0) {
      for (const tagName of options.tags) {
        const trimmed = tagName.trim();
        if (!trimmed) continue;
        let tag = db.prepare(`SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE`).get(options.userId, trimmed) as { id: string } | undefined;
        let tagId: string;
        if (!tag) {
          tagId = crypto.randomUUID();
          db.prepare(`INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`).run(tagId, options.userId, trimmed, now);
        } else {
          tagId = tag.id;
        }
        db.prepare(`INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)`).run(mediaId, tagId);
      }
    }

    // Insert into FTS5 normal_search_index if NOT private
    if (!options.isPrivate) {
      try {
        db.prepare(`
          INSERT INTO normal_search_index (entity_id, entity_type, user_id, title, content_or_desc, tag_names)
          VALUES (?, 'media', ?, ?, ?, ?)
        `).run(
          mediaId,
          options.userId,
          options.title,
          options.description ?? '',
          options.tags?.join(' ') ?? ''
        );
      } catch (err) {
        logger.warn({ err, mediaId }, 'FTS5 search indexing failed');
      }
    }

    return this.getMediaById(mediaId, options.userId, true) as Promise<MediaItem>;
  }

  async getMediaList(options: {
    userId: string;
    type?: MediaType;
    categoryId?: string;
    isVaultUnlocked: boolean;
    vaultOnly?: boolean;
    search?: string;
  }): Promise<MediaItem[]> {
    const db = getDatabaseService().getDb();

    let query = `
      SELECT m.*, c.name as category_name, c.color as category_color,
             p.position_seconds as playback_position
      FROM media m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN playback_progress p ON p.media_id = m.id AND p.user_id = ?
      WHERE 1=1
    `;
    const params: (string | number)[] = [options.userId];

    if (options.vaultOnly) {
      if (!options.isVaultUnlocked) return [];
      query += ` AND m.is_private = 1 AND m.user_id = ?`;
      params.push(options.userId);
    } else if (options.isVaultUnlocked) {
      // Unlocked vault: include public media AND this user's private media
      query += ` AND (m.is_private = 0 OR (m.is_private = 1 AND m.user_id = ?))`;
      params.push(options.userId);
    } else {
      // Locked: strictly public media only
      query += ` AND m.is_private = 0`;
    }

    if (options.search && options.search.trim()) {
      query += ` AND (m.title LIKE ? OR m.description LIKE ?)`;
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY m.created_at DESC`;

    interface MediaRow {
      id: string;
      user_id: string;
      type: string;
      title: string;
      description: string | null;
      category_id: string | null;
      category_name: string | null;
      category_color: string | null;
      is_private: number;
      file_size: number;
      mime_type: string;
      original_filename: string;
      file_extension: string;
      width: number | null;
      height: number | null;
      duration: number | null;
      play_count: number;
      is_favorite: number;
      playback_position: number | null;
      created_at: string;
      updated_at: string;
    }

    const rows = db.prepare(query).all(...params) as MediaRow[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type as MediaType,
      title: r.title,
      description: r.description,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      isPrivate: r.is_private === 1,
      fileSize: r.file_size,
      mimeType: r.mime_type,
      originalFilename: r.original_filename,
      fileExtension: r.file_extension,
      width: r.width,
      height: r.height,
      duration: r.duration,
      playCount: r.play_count,
      isFavorite: r.is_favorite === 1,
      playbackPosition: r.playback_position ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getMediaById(id: string, userId: string, isVaultUnlocked: boolean): Promise<MediaItem | null> {
    const db = getDatabaseService().getDb();
    const row = db.prepare(`
      SELECT m.*, c.name as category_name, c.color as category_color,
             p.position_seconds as playback_position
      FROM media m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN playback_progress p ON p.media_id = m.id AND p.user_id = ?
      WHERE m.id = ?
    `).get(userId, id) as Record<string, unknown> | undefined;

    if (!row) return null;
    if ((row.is_private as number) === 1) {
      if (row.user_id !== userId || !isVaultUnlocked) {
        return null;
      }
    }

    return {
      id: row.id as string,
      userId: row.user_id as string,
      type: row.type as MediaType,
      title: row.title as string,
      description: row.description as string | null,
      categoryId: row.category_id as string | null,
      categoryName: row.category_name as string | null,
      categoryColor: row.category_color as string | null,
      isPrivate: (row.is_private as number) === 1,
      fileSize: row.file_size as number,
      mimeType: row.mime_type as string,
      originalFilename: row.original_filename as string,
      fileExtension: row.file_extension as string,
      width: row.width as number | null,
      height: row.height as number | null,
      duration: row.duration as number | null,
      playCount: row.play_count as number,
      isFavorite: (row.is_favorite as number) === 1,
      playbackPosition: (row.playback_position as number | null) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private resolveActualFilePath(storedPath: string | null | undefined, isPrivate: boolean, isThumbnail: boolean = false): string | null {
    if (!storedPath) return null;
    if (fs.existsSync(storedPath)) {
      return storedPath;
    }
    if (fs.existsSync(storedPath + '.enc')) {
      return storedPath + '.enc';
    }
    // Cross-platform portable fallback: if the database was moved from Windows (E:\...) to Raspberry Pi Linux (/home/pi/...)
    // resolve the filename against the current active storage directory
    const filename = path.basename(storedPath);
    const parsed = path.parse(filename);
    const candidateDir = isThumbnail
      ? (isPrivate ? this.thumbPrivateDir : this.thumbNormalDir)
      : (isPrivate ? this.mediaPrivateDir : this.mediaNormalDir);
    const fallbackPath = path.join(candidateDir, filename);
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
    if (fs.existsSync(fallbackPath + '.enc')) {
      return fallbackPath + '.enc';
    }

    // Check alternate thumbnail extensions
    if (isThumbnail) {
      const extList = ['.webp', '.jpg', '.jpeg', '.png'];
      for (const ext of extList) {
        const altPath = path.join(candidateDir, `${parsed.name}${ext}`);
        if (fs.existsSync(altPath)) return altPath;
        if (fs.existsSync(altPath + '.enc')) return altPath + '.enc';
      }
    }
    return null;
  }

  getMediaFilePath(id: string, userId: string, isVaultUnlocked: boolean): {
    filePath: string;
    mimeType: string;
    fileSize: number;
    isPrivate: boolean;
    isEncrypted: boolean;
  } | null {
    const db = getDatabaseService().getDb();
    const row = db.prepare(`
      SELECT storage_path, mime_type, file_size, is_private, user_id
      FROM media
      WHERE id = ?
    `).get(id) as { storage_path: string; mime_type: string; file_size: number; is_private: number; user_id: string } | undefined;

    if (!row) return null;
    if (row.is_private === 1) {
      if (row.user_id !== userId || !isVaultUnlocked) {
        return null;
      }
    }

    const actualFilePath = this.resolveActualFilePath(row.storage_path, row.is_private === 1, false);
    if (!actualFilePath) {
      return null;
    }

    const isEncrypted = actualFilePath.endsWith('.enc');
    let actualSize = row.file_size;
    try {
      const stats = fs.statSync(actualFilePath);
      actualSize = isEncrypted ? Math.max(0, stats.size - 16) : stats.size;
    } catch { /* use db size */ }

    return {
      filePath: actualFilePath,
      mimeType: row.mime_type,
      fileSize: actualSize,
      isPrivate: row.is_private === 1,
      isEncrypted,
    };
  }

  getThumbnailPath(id: string, userId: string, isVaultUnlocked: boolean): {
    thumbPath: string;
    isPrivate: boolean;
    isEncrypted: boolean;
  } | null {
    const db = getDatabaseService().getDb();
    const row = db.prepare(`
      SELECT thumbnail_path, is_private, user_id
      FROM media
      WHERE id = ?
    `).get(id) as { thumbnail_path: string | null; is_private: number; user_id: string } | undefined;

    if (!row || !row.thumbnail_path) return null;
    if (row.is_private === 1) {
      if (row.user_id !== userId || !isVaultUnlocked) {
        return null;
      }
    }

    const actualThumbPath = this.resolveActualFilePath(row.thumbnail_path, row.is_private === 1, true);
    if (!actualThumbPath) {
      return null;
    }

    return {
      thumbPath: actualThumbPath,
      isPrivate: row.is_private === 1,
      isEncrypted: actualThumbPath.endsWith('.enc'),
    };
  }

  async deleteMedia(id: string, userId: string, isVaultUnlocked: boolean): Promise<boolean> {
    const media = await this.getMediaById(id, userId, isVaultUnlocked);
    if (!media) return false;

    const db = getDatabaseService().getDb();
    const row = db.prepare(`SELECT storage_path, thumbnail_path, is_private FROM media WHERE id = ? AND user_id = ?`).get(id, userId) as { storage_path: string; thumbnail_path: string | null; is_private: number } | undefined;

    if (row) {
      const isPriv = row.is_private === 1;
      const actualFilePath = this.resolveActualFilePath(row.storage_path, isPriv, false);
      if (actualFilePath && fs.existsSync(actualFilePath)) {
        try { fs.unlinkSync(actualFilePath); } catch { /* ignore */ }
      }
      if (actualFilePath && fs.existsSync(actualFilePath + '.enc')) {
        try { fs.unlinkSync(actualFilePath + '.enc'); } catch { /* ignore */ }
      }
      const actualThumbPath = this.resolveActualFilePath(row.thumbnail_path, isPriv, true);
      if (actualThumbPath && fs.existsSync(actualThumbPath)) {
        try { fs.unlinkSync(actualThumbPath); } catch { /* ignore */ }
      }
      if (actualThumbPath && fs.existsSync(actualThumbPath + '.enc')) {
        try { fs.unlinkSync(actualThumbPath + '.enc'); } catch { /* ignore */ }
      }
    }

    db.prepare(`DELETE FROM media WHERE id = ? AND user_id = ?`).run(id, userId);
    try {
      db.prepare(`DELETE FROM normal_search_index WHERE entity_id = ?`).run(id);
    } catch { /* ignore */ }

    return true;
  }

  savePlaybackProgress(userId: string, mediaId: string, positionSeconds: number, durationSeconds: number): void {
    const db = getDatabaseService().getDb();
    const completed = positionSeconds >= durationSeconds * 0.95 ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO playback_progress (user_id, media_id, position_seconds, duration_seconds, completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, media_id) DO UPDATE SET
        position_seconds = excluded.position_seconds,
        duration_seconds = excluded.duration_seconds,
        completed = excluded.completed,
        updated_at = excluded.updated_at
    `).run(userId, mediaId, positionSeconds, durationSeconds, completed, now);

    db.prepare(`UPDATE media SET play_count = play_count + 1 WHERE id = ? AND user_id = ?`).run(mediaId, userId);
  }

  deleteAllMedia(): void {
    for (const dir of [this.mediaNormalDir, this.mediaPrivateDir, this.thumbNormalDir, this.thumbPrivateDir]) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch { /* ignore */ }
        }
      }
    }
  }
}

let mediaServiceInstance: MediaService | null = null;
export function getMediaService(): MediaService {
  if (!mediaServiceInstance) {
    mediaServiceInstance = new MediaService();
  }
  return mediaServiceInstance;
}

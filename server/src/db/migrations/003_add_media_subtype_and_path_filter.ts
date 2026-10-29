import type Database from 'better-sqlite3';

export const migration = {
  version: 3,
  name: '003_add_media_subtype_and_path_filter',
  up: (db: Database.Database): void => {
    // 1. Add sub_type column to media table if not present
    const mediaColumns = db.prepare("PRAGMA table_info('media')").all() as { name: string }[];
    const hasSubType = mediaColumns.some((c) => c.name === 'sub_type');
    if (!hasSubType) {
      db.exec(`
        ALTER TABLE media ADD COLUMN sub_type TEXT NOT NULL DEFAULT 'movie';
      `);
    }

    // 2. Classify existing items accurately
    db.exec(`
      UPDATE media SET sub_type = 'photo' WHERE type = 'photo';
      UPDATE media SET sub_type = 'music' WHERE type = 'audio';
      UPDATE media 
      SET sub_type = 'family' 
      WHERE type = 'video' AND (
        (duration IS NOT NULL AND duration <= 900) 
        OR original_filename LIKE 'VID_%' 
        OR original_filename LIKE 'MOV_%' 
        OR original_filename LIKE 'PXL_%' 
        OR original_filename LIKE '%WhatsApp%'
        OR original_filename LIKE 'IMG_%'
      );
      CREATE INDEX IF NOT EXISTS idx_media_subtype ON media(sub_type);
    `);
  },
};


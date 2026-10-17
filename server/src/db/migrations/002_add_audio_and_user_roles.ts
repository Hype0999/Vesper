import type Database from 'better-sqlite3';

export const migration = {
  version: 2,
  name: '002_add_audio_and_user_roles',
  up: (db: Database.Database): void => {
    // 1. Add role column to users if not present
    const userColumns = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    const hasRole = userColumns.some((c) => c.name === 'role');
    if (!hasRole) {
      db.exec(`
        ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'member', 'guest'));
      `);
    }

    // 2. Safely recreate media table to allow 'audio' in check constraint
    db.exec(`
      PRAGMA foreign_keys=off;
      CREATE TABLE IF NOT EXISTS media_v2 (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('video', 'photo', 'audio')),
          title TEXT NOT NULL,
          description TEXT,
          category_id TEXT,
          is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
          storage_path TEXT NOT NULL,
          thumbnail_path TEXT,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_extension TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          duration REAL,
          play_count INTEGER NOT NULL DEFAULT 0,
          is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      INSERT OR IGNORE INTO media_v2 SELECT * FROM media;
      DROP TABLE IF EXISTS media;
      ALTER TABLE media_v2 RENAME TO media;

      CREATE INDEX IF NOT EXISTS idx_media_user_privacy ON media(user_id, is_private);
      CREATE INDEX IF NOT EXISTS idx_media_category ON media(category_id);
      CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);
      PRAGMA foreign_keys=on;
    `);
  },
};

import type Database from 'better-sqlite3';

export const migration = {
  version: 1,
  name: '001_initial_schema',
  up: (db: Database.Database): void => {
    db.exec(`
      -- 1. System Settings & Initialization State
      CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Users (Admin / User accounts)
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          vault_password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'member', 'guest')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 3. Hashed Normal Web Sessions (SHA-256 tokens)
      CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

      -- 4. Hashed Vault Sessions (1:1 with Web Session, short sliding TTL)
      CREATE TABLE IF NOT EXISTS vault_sessions (
          vault_token_hash TEXT PRIMARY KEY,
          session_token_hash TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_token_hash) REFERENCES sessions(token_hash) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vault_sessions_expires ON vault_sessions(expires_at);

      -- 5. Categories
      CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#3b82f6',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name COLLATE NOCASE),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- 6. Media Items (Videos, Photos, and Songs)
      CREATE TABLE IF NOT EXISTS media (
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
      CREATE INDEX IF NOT EXISTS idx_media_user_privacy ON media(user_id, is_private);
      CREATE INDEX IF NOT EXISTS idx_media_category ON media(category_id);
      CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

      -- 7. Notes (Normal plaintext or Private AES-256-GCM envelope)
      CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          is_encrypted INTEGER NOT NULL DEFAULT 0 CHECK(is_encrypted IN (0, 1)),
          category_id TEXT,
          is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
          is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
          is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_user_privacy ON notes(user_id, is_private);
      CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);

      -- 8. Tags
      CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name COLLATE NOCASE),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- 9. Explicit Relational Junction Tables (SEC-07 Fix)
      CREATE TABLE IF NOT EXISTS media_tags (
          media_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (media_id, tag_id),
          FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag_id);

      CREATE TABLE IF NOT EXISTS note_tags (
          note_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

      -- 10. Playback Progress (Local Account History)
      CREATE TABLE IF NOT EXISTS playback_progress (
          user_id TEXT NOT NULL,
          media_id TEXT NOT NULL,
          position_seconds REAL NOT NULL DEFAULT 0,
          duration_seconds REAL NOT NULL DEFAULT 0,
          completed INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, media_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
      );

      -- 11. Normal Search Index (FTS5: Public/Normal Content Only)
      CREATE VIRTUAL TABLE IF NOT EXISTS normal_search_index USING fts5(
          entity_id UNINDEXED,
          entity_type UNINDEXED,
          user_id UNINDEXED,
          title,
          content_or_desc,
          tag_names
      );
    `);
  },
};

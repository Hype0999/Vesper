import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseConnection } from '../src/db/connection.js';
import { MigrationRunner, type Migration } from '../src/db/migrator.js';

const TEST_STORAGE_DIR = path.resolve(process.cwd(), 'tests/scratch_db');
const TEST_DB_PATH = path.resolve(TEST_STORAGE_DIR, 'test-media-hub.sqlite');

function cleanTestDb() {
  if (fs.existsSync(TEST_STORAGE_DIR)) {
    try {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore Windows temporary handle lock
    }
  }
}

describe('Phase 2: SQLite Database Engine & Migration Tests', () => {
  beforeEach(() => {
    cleanTestDb();
  });

  afterEach(() => {
    cleanTestDb();
  });

  it('1. Database initializes successfully and creates missing parent directory', () => {
    expect(fs.existsSync(TEST_STORAGE_DIR)).toBe(false);

    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();

    expect(fs.existsSync(TEST_STORAGE_DIR)).toBe(true);
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    expect(db.open).toBe(true);

    conn.close();
  });

  it('2. Configures and explicitly verifies required PRAGMAs (WAL, synchronous=NORMAL, foreign_keys=ON)', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    conn.connect();
    const pragmas = conn.getPragmas();

    expect(pragmas.journalMode).toBe('wal');
    expect(pragmas.synchronous).toBe(1); // 1 = NORMAL in SQLite
    expect(pragmas.busyTimeout).toBe(5000);
    expect(pragmas.foreignKeys).toBe(1); // 1 = ON
    expect(pragmas.cacheSize).toBe(-20000);

    conn.close();
  });

  it('3. Migration runner applies all migrations on a clean database', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    const runner = new MigrationRunner();

    const result = runner.run(db);

    expect(result.appliedCount).toBe(2);
    expect(result.currentVersion).toBe(2);
    expect(result.appliedMigrations).toContain('001_initial_schema');
    expect(result.appliedMigrations).toContain('002_add_audio_and_user_roles');

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = new Set(tables.map((t) => t.name));

    expect(tableNames.has('schema_migrations')).toBe(true);
    expect(tableNames.has('system_settings')).toBe(true);
    expect(tableNames.has('users')).toBe(true);
    expect(tableNames.has('sessions')).toBe(true);
    expect(tableNames.has('vault_sessions')).toBe(true);
    expect(tableNames.has('categories')).toBe(true);
    expect(tableNames.has('media')).toBe(true);
    expect(tableNames.has('notes')).toBe(true);
    expect(tableNames.has('tags')).toBe(true);
    expect(tableNames.has('media_tags')).toBe(true);
    expect(tableNames.has('note_tags')).toBe(true);
    expect(tableNames.has('playback_progress')).toBe(true);
    expect(tableNames.has('normal_search_index')).toBe(true);

    conn.close();
  });

  it('4. Starting against an already migrated database is idempotent and does not re-apply migrations', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    const runner = new MigrationRunner();

    // First run
    runner.run(db);

    // Second run
    const secondRun = runner.run(db);
    expect(secondRun.appliedCount).toBe(0);
    expect(secondRun.currentVersion).toBe(2);
    expect(secondRun.appliedMigrations.length).toBe(0);

    conn.close();
  });

  it('5. Foreign-key enforcement rejects invalid relationships', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    // Attempt to insert session for nonexistent user
    expect(() => {
      db.prepare(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
      ).run('test_token_hash_1', 'nonexistent_user_id', new Date().toISOString());
    }).toThrow(/FOREIGN KEY constraint failed/);

    conn.close();
  });

  it('6. CASCADE deletion works for media_tags when media item is deleted', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    // Seed user
    db.prepare(
      'INSERT INTO users (id, username, password_hash, vault_password_hash) VALUES (?, ?, ?, ?)',
    ).run('u1', 'testadmin', 'hash1', 'vault_hash1');

    // Seed media
    db.prepare(`
      INSERT INTO media (id, user_id, type, title, storage_path, file_size, mime_type, original_filename, file_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m1', 'u1', 'photo', 'Test Photo', 'normal/originals/m1.jpg', 1024, 'image/jpeg', 'photo.jpg', 'jpg');

    // Seed tag
    db.prepare('INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)').run('t1', 'u1', 'Landscape');

    // Link tag
    db.prepare('INSERT INTO media_tags (media_id, tag_id) VALUES (?, ?)').run('m1', 't1');

    expect(db.prepare('SELECT COUNT(*) as c FROM media_tags WHERE media_id = ?').get('m1')).toEqual({ c: 1 });

    // Delete media
    db.prepare('DELETE FROM media WHERE id = ?').run('m1');

    // Expect junction row automatically deleted via CASCADE
    expect(db.prepare('SELECT COUNT(*) as c FROM media_tags WHERE media_id = ?').get('m1')).toEqual({ c: 0 });
    // Tag itself should still exist
    expect(db.prepare('SELECT COUNT(*) as c FROM tags WHERE id = ?').get('t1')).toEqual({ c: 1 });

    conn.close();
  });

  it('7. CASCADE deletion works for note_tags when note is deleted', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    db.prepare(
      'INSERT INTO users (id, username, password_hash, vault_password_hash) VALUES (?, ?, ?, ?)',
    ).run('u1', 'testadmin', 'hash1', 'vault_hash1');

    db.prepare('INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)').run('n1', 'u1', 'Meeting Note', 'Details');
    db.prepare('INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)').run('t1', 'u1', 'Work');
    db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n1', 't1');

    expect(db.prepare('SELECT COUNT(*) as c FROM note_tags WHERE note_id = ?').get('n1')).toEqual({ c: 1 });

    db.prepare('DELETE FROM notes WHERE id = ?').run('n1');

    expect(db.prepare('SELECT COUNT(*) as c FROM note_tags WHERE note_id = ?').get('n1')).toEqual({ c: 0 });

    conn.close();
  });

  it('8. CASCADE deletion works for playback_progress when media is deleted', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    db.prepare(
      'INSERT INTO users (id, username, password_hash, vault_password_hash) VALUES (?, ?, ?, ?)',
    ).run('u1', 'testadmin', 'hash1', 'vault_hash1');

    db.prepare(`
      INSERT INTO media (id, user_id, type, title, storage_path, file_size, mime_type, original_filename, file_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m_video', 'u1', 'video', 'Test Video', 'normal/originals/v.mp4', 5000, 'video/mp4', 'v.mp4', 'mp4');

    db.prepare(`
      INSERT INTO playback_progress (user_id, media_id, position_seconds, duration_seconds)
      VALUES (?, ?, ?, ?)
    `).run('u1', 'm_video', 42.5, 120.0);

    expect(db.prepare('SELECT COUNT(*) as c FROM playback_progress WHERE media_id = ?').get('m_video')).toEqual({ c: 1 });

    db.prepare('DELETE FROM media WHERE id = ?').run('m_video');

    expect(db.prepare('SELECT COUNT(*) as c FROM playback_progress WHERE media_id = ?').get('m_video')).toEqual({ c: 0 });

    conn.close();
  });

  it('9. User deletion cascades to sessions, vault_sessions, media, and notes', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    db.prepare(
      'INSERT INTO users (id, username, password_hash, vault_password_hash) VALUES (?, ?, ?, ?)',
    ).run('u1', 'testadmin', 'hash1', 'vault_hash1');

    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run('s_hash', 'u1', new Date().toISOString());
    db.prepare('INSERT INTO vault_sessions (vault_token_hash, session_token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)').run(
      'v_hash',
      's_hash',
      'u1',
      new Date().toISOString(),
    );
    db.prepare('INSERT INTO notes (id, user_id, title) VALUES (?, ?, ?)').run('n1', 'u1', 'Private thought');

    expect(db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get('u1')).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) as c FROM vault_sessions WHERE user_id = ?').get('u1')).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) as c FROM notes WHERE user_id = ?').get('u1')).toEqual({ c: 1 });

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run('u1');

    // All should be cascaded
    expect(db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get('u1')).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM vault_sessions WHERE user_id = ?').get('u1')).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM notes WHERE user_id = ?').get('u1')).toEqual({ c: 0 });

    conn.close();
  });

  it('10. Category deletion sets media and note category_id to NULL safely (ON DELETE SET NULL)', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    db.prepare(
      'INSERT INTO users (id, username, password_hash, vault_password_hash) VALUES (?, ?, ?, ?)',
    ).run('u1', 'testadmin', 'hash1', 'vault_hash1');

    db.prepare('INSERT INTO categories (id, user_id, name) VALUES (?, ?, ?)').run('cat1', 'u1', 'Travel');

    db.prepare(`
      INSERT INTO media (id, user_id, type, title, category_id, storage_path, file_size, mime_type, original_filename, file_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m1', 'u1', 'photo', 'Vacation Photo', 'cat1', 'normal/originals/m1.jpg', 1024, 'image/jpeg', 'm.jpg', 'jpg');

    db.prepare('INSERT INTO notes (id, user_id, title, category_id) VALUES (?, ?, ?, ?)').run('n1', 'u1', 'Itinerary', 'cat1');

    // Delete category
    db.prepare('DELETE FROM categories WHERE id = ?').run('cat1');

    // Media and notes still exist, but category_id is NULL
    const mediaRow = db.prepare('SELECT category_id FROM media WHERE id = ?').get('m1') as { category_id: string | null };
    const noteRow = db.prepare('SELECT category_id FROM notes WHERE id = ?').get('n1') as { category_id: string | null };

    expect(mediaRow.category_id).toBeNull();
    expect(noteRow.category_id).toBeNull();

    conn.close();
  });

  it('11. FTS5 table exists and accepts a normal record, and can be queried', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();
    new MigrationRunner().run(db);

    // Insert normal media into FTS5
    db.prepare(`
      INSERT INTO normal_search_index (entity_id, entity_type, user_id, title, content_or_desc, tag_names)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('m_normal_1', 'media', 'u1', 'Mountain Sunset at Alps', 'A beautiful landscape photo of snowy peaks', 'nature alps mountain');

    // Query FTS5
    const matchResults = db.prepare(`
      SELECT entity_id, title FROM normal_search_index WHERE normal_search_index MATCH ?
    `).all('sunset') as { entity_id: string; title: string }[];

    expect(matchResults.length).toBe(1);
    expect(matchResults[0]?.entity_id).toBe('m_normal_1');

    conn.close();
  });

  it('12. Deliberately failing migration rolls back and leaves schema version unchanged', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    const db = conn.connect();

    const validMigration: Migration = {
      version: 1,
      name: '001_valid',
      up: (database) => {
        database.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY);');
      },
    };

    const failingMigration: Migration = {
      version: 2,
      name: '002_broken',
      up: (database) => {
        database.exec('CREATE TABLE test_table_2 (id INTEGER PRIMARY KEY);');
        // Syntax error to trigger rollback
        database.exec('INVALID SQL SYNTAX HERE FAIL;');
      },
    };

    const runner = new MigrationRunner([validMigration, failingMigration]);

    expect(() => {
      runner.run(db);
    }).toThrow(/Migration 002_broken/);

    // Schema version should remain at 1
    const currentVersion = runner.getCurrentVersion(db);
    expect(currentVersion).toBe(1);

    // Table from rolled-back migration 2 must NOT exist
    const table2 = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table_2'").get();
    expect(table2).toBeUndefined();

    conn.close();
  });

  it('13. Checkpoint executes safely on connection', () => {
    const conn = new DatabaseConnection(TEST_DB_PATH);
    conn.connect();

    expect(() => {
      conn.checkpoint('TRUNCATE');
    }).not.toThrow();

    conn.close();
  });
});

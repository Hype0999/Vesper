import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { migration as initialMigration } from './migrations/001_initial_schema.js';
import { migration as migration002 } from './migrations/002_add_audio_and_user_roles.js';
import { migration as migration003 } from './migrations/003_add_media_subtype_and_path_filter.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export interface MigrationResult {
  appliedCount: number;
  currentVersion: number;
  appliedMigrations: string[];
}

export class MigrationRunner {
  private readonly migrations: Migration[];

  constructor(customMigrations?: Migration[]) {
    this.migrations = customMigrations ?? [initialMigration, migration002, migration003];
    // Ensure sorted monotonically
    this.migrations.sort((a, b) => a.version - b.version);
  }

  public run(db: Database.Database): MigrationResult {
    // 1. Ensure migrations tracking table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already applied versions
    const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
    const appliedSet = new Set<number>(rows.map((r) => r.version));
    const currentMaxVersion = rows.length > 0 ? (rows[rows.length - 1]?.version ?? 0) : 0;

    const pending = this.migrations.filter((m) => !appliedSet.has(m.version));

    if (pending.length === 0) {
      logger.debug({ currentVersion: currentMaxVersion }, 'Database schema is up to date. No pending migrations.');
      return {
        appliedCount: 0,
        currentVersion: currentMaxVersion,
        appliedMigrations: [],
      };
    }

    const appliedNames: string[] = [];

    // 3. Execute pending migrations inside atomic transactions
    for (const m of pending) {
      logger.info({ migration: m.name, version: m.version }, 'Applying database migration...');

      const executeSingleMigration = db.transaction(() => {
        m.up(db);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
      });

      try {
        executeSingleMigration();
        appliedNames.push(m.name);
        logger.info({ migration: m.name, version: m.version }, 'Successfully applied database migration');
      } catch (err) {
        logger.fatal(
          {
            migration: m.name,
            version: m.version,
            error: err instanceof Error ? err.message : String(err),
          },
          'Database migration failed and was rolled back. Halting startup.',
        );
        throw new Error(`Migration ${m.name} (v${m.version}) failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const finalRow = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
    const finalVersion = finalRow?.version ?? 0;

    return {
      appliedCount: appliedNames.length,
      currentVersion: finalVersion,
      appliedMigrations: appliedNames,
    };
  }

  public getCurrentVersion(db: Database.Database): number {
    try {
      const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null } | undefined;
      return row?.version ?? 0;
    } catch {
      return 0;
    }
  }
}

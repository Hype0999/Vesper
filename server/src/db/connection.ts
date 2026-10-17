import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface VerifiedPragmas {
  journalMode: string;
  synchronous: number;
  busyTimeout: number;
  foreignKeys: number;
  cacheSize: number;
}

export class DatabaseConnection {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath ?? env.resolvedDatabasePath;
  }

  public connect(): Database.Database {
    if (this.db) {
      return this.db;
    }

    // 1. Ensure directory exists safely
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
    }

    // 2. Open SQLite database
    const db = new Database(this.dbPath, {
      timeout: 5000,
      verbose: env.isDevelopment && env.LOG_LEVEL === 'trace' ? (sql) => logger.trace({ sql }, 'SQL Executed') : undefined,
    });

    // 3. Configure PRAGMAs
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -20000');

    // 4. Verify PRAGMAs explicitly
    const journalModeResult = db.pragma('journal_mode', { simple: true }) as string;
    const synchronousResult = Number(db.pragma('synchronous', { simple: true }));
    const busyTimeoutResult = Number(db.pragma('busy_timeout', { simple: true }));
    const foreignKeysResult = Number(db.pragma('foreign_keys', { simple: true }));
    const cacheSizeResult = Number(db.pragma('cache_size', { simple: true }));

    const verified: VerifiedPragmas = {
      journalMode: journalModeResult.toLowerCase(),
      synchronous: synchronousResult,
      busyTimeout: busyTimeoutResult,
      foreignKeys: foreignKeysResult,
      cacheSize: cacheSizeResult,
    };

    if (verified.journalMode !== 'wal') {
      throw new Error(`Failed to initialize SQLite in WAL mode. Got: ${verified.journalMode}`);
    }
    if (verified.foreignKeys !== 1) {
      throw new Error(`Failed to enable SQLite foreign keys. Got: ${verified.foreignKeys}`);
    }

    // Log verified PRAGMAs safely without exposing filesystem paths
    logger.info(
      {
        pragmas: {
          journal_mode: verified.journalMode,
          synchronous: verified.synchronous, // 1 = NORMAL
          busy_timeout: verified.busyTimeout,
          foreign_keys: verified.foreignKeys, // 1 = ON
          cache_size: verified.cacheSize,
        },
      },
      'SQLite initialized with verified PRAGMAs (WAL mode, foreign keys active)',
    );

    this.db = db;
    return db;
  }

  public getDatabase(): Database.Database {
    if (!this.db) {
      return this.connect();
    }
    return this.db;
  }

  public getPragmas(): VerifiedPragmas {
    const db = this.getDatabase();
    return {
      journalMode: (db.pragma('journal_mode', { simple: true }) as string).toLowerCase(),
      synchronous: Number(db.pragma('synchronous', { simple: true })),
      busyTimeout: Number(db.pragma('busy_timeout', { simple: true })),
      foreignKeys: Number(db.pragma('foreign_keys', { simple: true })),
      cacheSize: Number(db.pragma('cache_size', { simple: true })),
    };
  }

  public checkpoint(mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'TRUNCATE'): void {
    const db = this.getDatabase();
    db.pragma(`wal_checkpoint(${mode})`);
    logger.debug({ checkpointMode: mode }, 'Executed SQLite WAL checkpoint');
  }

  public close(): void {
    if (this.db) {
      try {
        this.checkpoint('TRUNCATE');
        this.db.close();
      } finally {
        this.db = null;
      }
    }
  }
}

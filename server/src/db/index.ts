import type Database from 'better-sqlite3';
import { DatabaseConnection, type VerifiedPragmas } from './connection.js';
import { MigrationRunner, type MigrationResult } from './migrator.js';
import { logger } from '../utils/logger.js';

export interface DatabaseService {
  getDb: () => Database.Database;
  getPragmas: () => VerifiedPragmas;
  getMigrationVersion: () => number;
  runMigrations: () => MigrationResult;
  runInTransaction: <T>(fn: (db: Database.Database) => T) => T;
  checkpoint: (mode?: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE') => void;
  getHealth: () => { status: 'ok' | 'degraded' | 'error'; migrationVersion: number };
  close: () => void;
}

let activeService: DatabaseService | null = null;

export function initDatabase(customPath?: string): DatabaseService {
  if (activeService) {
    return activeService;
  }

  const connection = new DatabaseConnection(customPath);
  const db = connection.connect();
  const migrator = new MigrationRunner();

  // Run pending migrations on startup
  const migrationResult = migrator.run(db);

  logger.info(
    {
      appliedMigrationsCount: migrationResult.appliedCount,
      currentSchemaVersion: migrationResult.currentVersion,
    },
    'Database migration sequence verified and complete',
  );

  const service: DatabaseService = {
    getDb: () => connection.getDatabase(),
    getPragmas: () => connection.getPragmas(),
    getMigrationVersion: () => migrator.getCurrentVersion(connection.getDatabase()),
    runMigrations: () => migrator.run(connection.getDatabase()),
    runInTransaction: <T>(fn: (db: Database.Database) => T): T => {
      const database = connection.getDatabase();
      return database.transaction(() => fn(database))();
    },
    checkpoint: (mode) => connection.checkpoint(mode),
    getHealth: () => {
      try {
        const database = connection.getDatabase();
        // Simple fast read check
        database.prepare('SELECT 1').get();
        const version = migrator.getCurrentVersion(database);
        return {
          status: 'ok',
          migrationVersion: version,
        };
      } catch (err) {
        logger.error({ err }, 'Database health check failed');
        return {
          status: 'error',
          migrationVersion: 0,
        };
      }
    },
    close: () => {
      connection.close();
      activeService = null;
    },
  };

  activeService = service;
  return service;
}

export function getDatabaseService(): DatabaseService {
  if (!activeService) {
    return initDatabase();
  }
  return activeService;
}

export function closeDatabase(): void {
  if (activeService) {
    activeService.close();
    activeService = null;
  }
}

export * from './connection.js';
export * from './migrator.js';

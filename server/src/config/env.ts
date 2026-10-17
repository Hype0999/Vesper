import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');

// Load .env from root if available
dotenv.config({ path: path.resolve(projectRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  STORAGE_DIR: z.string().default('./storage'),
  DATABASE_PATH: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://raspberrypi.local:3000,http://travelhub.local:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

const baseStorageDir = path.isAbsolute(parsed.data.STORAGE_DIR)
  ? parsed.data.STORAGE_DIR
  : path.resolve(projectRoot, parsed.data.STORAGE_DIR);

const resolvedStorageDir = parsed.data.NODE_ENV === 'test'
  ? path.resolve(projectRoot, 'storage/test-storage')
  : baseStorageDir;

const defaultDbPath = parsed.data.NODE_ENV === 'test'
  ? path.resolve(projectRoot, 'storage/test-database/test-media-hub.sqlite')
  : path.resolve(resolvedStorageDir, 'database/media-hub.sqlite');

export const env = {
  ...parsed.data,
  projectRoot,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  allowedOriginsArray: parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  resolvedStorageDir,
  resolvedDatabasePath: parsed.data.DATABASE_PATH
    ? (path.isAbsolute(parsed.data.DATABASE_PATH)
        ? parsed.data.DATABASE_PATH
        : path.resolve(projectRoot, parsed.data.DATABASE_PATH))
    : defaultDbPath,
};


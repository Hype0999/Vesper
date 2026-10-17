import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'password',
      'passwordConfirm',
      'vaultPassword',
      'vaultPasswordConfirm',
      'token',
      'rawToken',
      'rawVaultToken',
      'sessionSecret',
      'storage_path',
      'storagePath',
      'content', // Note contents
    ],
    censor: '[REDACTED_SECURITY_SENSITIVE]',
  },
  transport: env.isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

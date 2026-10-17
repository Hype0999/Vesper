import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './db/index.js';

async function main() {
  // Initialize database and run migrations prior to listening
  initDatabase();

  const app = await buildApp();

  // Graceful shutdown handling
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, 'Received termination signal, initiating graceful shutdown...');
      try {
        await app.close();
        closeDatabase();
        logger.info('Server and database closed cleanly. Process exiting.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  }


  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀 Private Media Hub server listening at ${address}`);
    logger.info(`Environment: ${env.NODE_ENV} | Node: ${process.version}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void main();

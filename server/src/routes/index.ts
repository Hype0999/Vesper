import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { setupRoutes } from './setup.routes.js';
import { authRoutes } from './auth.routes.js';
import { vaultRoutes } from './vault.routes.js';
import { mediaRoutes } from './media.routes.js';
import { notesRoutes } from './notes.routes.js';
import { categoriesRoutes } from './categories.routes.js';
import { networkRoutes } from './network.routes.js';
import { usersRoutes } from './users.routes.js';
import { adminRoutes } from './admin.routes.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes, { prefix: '/system' });
  await fastify.register(setupRoutes, { prefix: '/setup' });
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(vaultRoutes, { prefix: '/vault' });
  await fastify.register(mediaRoutes, { prefix: '/media' });
  await fastify.register(notesRoutes, { prefix: '/notes' });
  await fastify.register(categoriesRoutes, { prefix: '/categories' });
  await fastify.register(networkRoutes, { prefix: '/network' });
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(adminRoutes, { prefix: '/admin' });
};



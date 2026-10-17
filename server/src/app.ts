import fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiErrorResponse } from '@media-hub/shared';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiRoutes } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = fastify({
    logger,
    disableRequestLogging: false,
    trustProxy: false,
  });

  // 1. Security Headers (Helmet)
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  function isOriginAllowed(origin: string, hostHeader?: string): boolean {
    if (!origin) return true;
    try {
      const originUrl = new URL(origin);
      // Same-host match (e.g. phone accessing http://travelhub.local:3000 matches Host: travelhub.local:3000)
      if (hostHeader) {
        const cleanHost = hostHeader.toLowerCase();
        if (originUrl.host.toLowerCase() === cleanHost || originUrl.hostname.toLowerCase() === cleanHost.split(':')[0]) {
          return true;
        }
      }
      // Allow localhost, loopback, .local mDNS domains, and RFC 1918 private subnets
      const hostname = originUrl.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return true;
      }
      return env.allowedOriginsArray.includes(origin);
    } catch {
      return false;
    }
  }

  // 2. Multipart file uploads (Up to 50GB for high-bitrate 4K movies)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024 * 1024, // 50GB
      files: 50,
    },
  });

  // 3. Cookie Parser
  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
  });

  // 3. CORS (Allow local network, .local mDNS, and configured origins)
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || isOriginAllowed(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  });

  // 3. Mandatory Origin / Referer Validation Hook for State-Modifying Requests
  app.addHook('preValidation', async (request, reply) => {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const origin = request.headers.origin;
      const referer = request.headers.referer;
      const host = request.headers.host;

      if (origin) {
        if (!isOriginAllowed(origin, host)) {
          request.log.warn({ origin, host }, 'Rejected state-modifying request: Forbidden origin');
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN_ORIGIN',
              message: 'Cross-origin request rejected.',
            },
          } satisfies ApiErrorResponse);
        }
      } else if (referer) {
        try {
          const refererOrigin = new URL(referer).origin;
          if (!isOriginAllowed(refererOrigin, host)) {
            request.log.warn({ refererOrigin, host }, 'Rejected state-modifying request: Forbidden referer');
            return reply.status(403).send({
              success: false,
              error: {
                code: 'FORBIDDEN_REFERER',
                message: 'Cross-origin referer rejected.',
              },
            } satisfies ApiErrorResponse);
          }
        } catch {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'MALFORMED_REFERER',
              message: 'Invalid referer header.',
            },
          } satisfies ApiErrorResponse);
        }
      }
    }
  });

  // 4. Register API Routes
  await app.register(apiRoutes, { prefix: '/api' });

  // 5. Static Client SPA Serving (In production or if client/dist exists)
  const candidateDistPaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ];
  const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(p));

  if (clientDistPath) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      wildcard: false,
    });
  }

  // 6. Global Not Found Handler (Unified JSON 404 for API, SPA fallback for Web)
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
        },
      } satisfies ApiErrorResponse);
    }

    if (clientDistPath) {
      const indexPath = path.join(clientDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').sendFile('index.html');
      }
    }

    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Page not found',
      },
    } satisfies ApiErrorResponse);
  });



  // 6. Centralized Error Handler (Information Leakage Protection)
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error.message, code: error.code }, 'Unhandled application error');

    const statusCode = error.statusCode ?? 500;
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code ?? (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        message: env.isProduction && statusCode >= 500 ? 'An internal server error occurred' : error.message,
      },
    };

    reply.status(statusCode).send(response);
  });

  return app;
}

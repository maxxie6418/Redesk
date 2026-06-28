import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import session from '@fastify/session';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync } from 'node:fs';
import { config } from './config';
import { errorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { bookRoutes } from './routes/books';
import { settingsRoutes } from './routes/settings';
import { userRoutes } from './routes/users';
import { systemRoutes } from './routes/system';
import { categoryRoutes } from './routes/categories';
import { tagRoutes } from './routes/tags';
import { relationRoutes } from './routes/relations';
import { fileRoutes } from './routes/files';
import { exportRoutes } from './routes/export';

interface SendFileReply {
  sendFile: (path: string) => FastifyReply;
}

function hasSendFile(reply: FastifyReply): reply is FastifyReply & SendFileReply {
  return typeof (reply as unknown as SendFileReply).sendFile === 'function';
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.isDev
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', singleLine: true } } }
        : {}),
    },
    trustProxy: true,
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(cors, {
    origin: [config.webUrl],
    credentials: true,
  });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 200 * 1024 * 1024,
    },
  });
  await app.register(session, {
    secret: config.sessionSecret,
    cookieName: 'sid',
    cookie: {
      secure: 'auto',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(async (api) => {
    await api.register(authRoutes, { prefix: '/api/v1' });
    await api.register(bookRoutes, { prefix: '/api/v1' });
    await api.register(settingsRoutes, { prefix: '/api/v1' });
    await api.register(userRoutes, { prefix: '/api/v1' });
    await api.register(systemRoutes, { prefix: '/api/v1' });
    await api.register(categoryRoutes, { prefix: '/api/v1' });
    await api.register(tagRoutes, { prefix: '/api/v1' });
    await api.register(relationRoutes, { prefix: '/api/v1' });
    await api.register(fileRoutes, { prefix: '/api/v1' });
    await api.register(exportRoutes, { prefix: '/api/v1' });
  });

  const spaExists = existsSync(config.spaDir);
  if (spaExists) {
    await app.register(fastifyStatic, {
      root: config.spaDir,
      prefix: '/',
      wildcard: false,
      decorateReply: true,
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/opds/')) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `路由不存在: ${req.method} ${req.url}` },
      });
    }
    if (hasSendFile(reply)) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `路由不存在: ${req.method} ${req.url}` },
    });
  });

  return app;
}

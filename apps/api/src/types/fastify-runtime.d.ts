import '@fastify/multipart';
import '@fastify/session';
import type { MultipartFile } from '@fastify/multipart';

declare module 'fastify' {
  interface FastifyRequest {
    session: {
      userId?: number;
      destroy: () => Promise<void>;
    };
    file: () => Promise<MultipartFile | undefined>;
  }
}

declare module '@fastify/cookie' {
  const fastifyCookie: (instance: unknown, opts: { secret: string }, done: (err?: Error) => void) => void;
  export default fastifyCookie;
}

declare module '@fastify/session' {
  const fastifySession: (instance: unknown, opts: Record<string, unknown>, done: (err?: Error) => void) => void;
  export default fastifySession;
}

declare module '@fastify/multipart' {
  const fastifyMultipart: (instance: unknown, opts: Record<string, unknown>, done: (err?: Error) => void) => void;
  export default fastifyMultipart;
}

declare module '@fastify/static' {
  const fastifyStatic: (instance: unknown, opts: Record<string, unknown>, done: (err?: Error) => void) => void;
  export default fastifyStatic;
}

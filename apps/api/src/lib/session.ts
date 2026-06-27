import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface Session {
    userId?: number;
  }
}

export function setSessionUserId(req: FastifyRequest, userId: number): void {
  req.session.userId = userId;
}

export async function clearSession(req: FastifyRequest): Promise<void> {
  await req.session.destroy();
}

export function getSessionUserId(req: FastifyRequest): number | undefined {
  return req.session.userId;
}

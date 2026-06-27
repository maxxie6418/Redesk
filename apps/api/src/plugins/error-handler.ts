import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { ERROR_CODE, type ErrorDetail } from '@redesk/shared';
import { config } from '../config';

function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'value',
    issue: issue.message,
  }));
}

export function errorHandler(
  error: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.code(400).send({
      error: {
        code: ERROR_CODE.VALIDATION_ERROR,
        message: '参数校验失败',
        details: zodDetails(error),
      },
    });
    return;
  }

  if (error.validation) {
    reply.code(error.statusCode ?? 400).send({
      error: {
        code: ERROR_CODE.VALIDATION_ERROR,
        message: error.message,
      },
    });
    return;
  }

  req.log.error({ err: error }, '未处理错误');
  reply.code(500).send({
    error: {
      code: ERROR_CODE.INTERNAL_ERROR,
      message: config.isProd ? '服务器内部错误' : (error.message ?? '服务器内部错误'),
    },
  });
}

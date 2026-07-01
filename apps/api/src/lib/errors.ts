import { ERROR_CODE, STATUS_BY_CODE, type ErrorCode, type ErrorDetail } from '@redesk/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetail[];
  readonly extra?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[] | Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    if (details) {
      if (Array.isArray(details)) {
        this.details = details;
      } else {
        this.extra = details;
      }
    }
  }
}

export function notFound(message = '资源不存在'): AppError {
  return new AppError(ERROR_CODE.NOT_FOUND, message);
}

export function unauthorized(message = '未登录'): AppError {
  return new AppError(ERROR_CODE.UNAUTHORIZED, message);
}

export function businessError(message: string): AppError {
  return new AppError(ERROR_CODE.BUSINESS_ERROR, message);
}

export function forbidden(message = '无权限'): AppError {
  return new AppError(ERROR_CODE.FORBIDDEN, message);
}

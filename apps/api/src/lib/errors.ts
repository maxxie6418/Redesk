import { ERROR_CODE, STATUS_BY_CODE, type ErrorCode, type ErrorDetail } from '@redesk/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
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

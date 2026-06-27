import type { ZodType } from 'zod';
import { ERROR_CODE, type ErrorDetail } from '@redesk/shared';
import { AppError } from './errors';

export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details: ErrorDetail[] = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'value',
      issue: issue.message,
    }));
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '参数校验失败', details);
  }
  return result.data;
}

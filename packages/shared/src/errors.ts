export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_ERROR: 'BUSINESS_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_ERROR: 422,
  INTERNAL_ERROR: 500,
};

export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

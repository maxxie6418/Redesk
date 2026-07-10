export interface AuthUser {
  id: number;
  username: string | null;
  display_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  permission_level: string;
  must_change_password: boolean;
}

export interface AuthStatus {
  needs_setup: boolean;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: { field: string; issue: string }[];
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly code: string;
  readonly details?: { field: string; issue: string }[];

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.details = shape.details;
  }
}

const UNEXPECTED_RESPONSE_ERROR: ApiErrorShape = {
  code: 'INTERNAL_ERROR',
  message: '服务返回了非预期响应',
};

function parseJsonResponse(text: string): unknown {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(UNEXPECTED_RESPONSE_ERROR);
  }
}

async function requestBody(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  const isFormData = init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  const text = await res.text();
  const body = parseJsonResponse(text);

  if (!res.ok) {
    const err = (body as { error?: ApiErrorShape } | null)?.error ?? {
      code: 'INTERNAL_ERROR',
      message: '请求失败',
    };
    throw new ApiError(err);
  }

  return body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await requestBody(path, init);
  return (body as { data?: T } | null)?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getBody: <T>(path: string) => requestBody(path) as Promise<T>,
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data === undefined ? undefined : JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data === undefined ? undefined : JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

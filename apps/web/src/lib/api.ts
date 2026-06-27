export interface AuthUser {
  id: number;
  username: string;
  display_name: string | null;
}

export interface AuthStatus {
  needs_setup: boolean;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: { field: string; issue: string }[];
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (body as { error?: ApiErrorShape } | null)?.error ?? {
      code: 'INTERNAL_ERROR',
      message: '请求失败',
    };
    throw new ApiError(err);
  }
  return (body as { data?: T } | null)?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data === undefined ? undefined : JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

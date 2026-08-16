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

export interface CsvImportProgressData {
  processed: number;
  total: number;
  row: number;
  title: string | null;
  status: 'created' | 'skipped' | 'failed';
  error: string | null;
  book_id: number | null;
}

export interface CsvImportCompleteData {
  created: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
}

export interface RunCsvImportOptions {
  file: File;
  onProgress: (data: CsvImportProgressData) => void;
  signal?: AbortSignal;
}

export async function runCsvImportStream(options: RunCsvImportOptions): Promise<CsvImportCompleteData> {
  const form = new FormData();
  form.append('file', options.file);

  const res = await fetch(`${API_BASE}/books/import/run`, {
    method: 'POST',
    credentials: 'include',
    body: form,
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    let err: ApiErrorShape = UNEXPECTED_RESPONSE_ERROR;
    try {
      const text = await res.text();
      const body = parseJsonResponse(text) as { error?: ApiErrorShape } | null;
      if (body?.error) err = body.error;
    } catch {
      err = UNEXPECTED_RESPONSE_ERROR;
    }
    throw new ApiError(err);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete: CsvImportCompleteData | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let splitAt: number;
      while ((splitAt = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, splitAt);
        buffer = buffer.slice(splitAt + 2);
        const event = block.match(/^event: (.+)$/m)?.[1];
        const dataLine = block.match(/^data: (.+)$/m)?.[1];
        if (!dataLine) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataLine) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (event === 'progress') {
          options.onProgress(data as unknown as CsvImportProgressData);
        } else if (event === 'complete') {
          complete = data as unknown as CsvImportCompleteData;
        } else if (event === 'error') {
          throw new ApiError(data as unknown as ApiErrorShape);
        }
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw err;
  }

  if (!complete) {
    throw new ApiError(UNEXPECTED_RESPONSE_ERROR);
  }
  return complete;
}

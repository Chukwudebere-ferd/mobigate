/**
 * Low-level HTTP client for the Go API.
 *
 * The Go backend owns the recruitment and personnel domain. Authentication
 * (Better Auth) issues a session cookie; this client sends it automatically
 * and treats 401 as "signed out".
 *
 * The frontend runs against mocks by default (see src/lib/api/index.ts).
 * Setting VITE_API_MODE=live points these calls at the Go server.
 */

export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get isUnauthorized() {
    return this.status === 401
  }
  get isForbidden() {
    return this.status === 403
  }
  get isNotFound() {
    return this.status === 404
  }
  /** Cross-tenant reads surface as 404 by design (README BR-15). */
  get isCrossTenant() {
    return this.status === 404
  }
}

// The Go API is mounted under /api. VITE_API_URL may override this with a
// full origin, e.g. https://api.example.com/api.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.append(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, headers, ...rest } = options

  const response = await fetch(buildUrl(path, query), {
    credentials: 'include',
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    // A non-JSON body means the request hit the SPA fallback or a proxy
    // error, not the Go API. Fail loudly instead of casting text to T.
    throw new ApiError(
      response.status,
      `Expected JSON from ${path}, received ${contentType || 'no content type'}`,
    )
  }
  const payload: unknown = await response.json()

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${response.status}`
    throw new ApiError(response.status, message, payload)
  }

  return payload as T
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

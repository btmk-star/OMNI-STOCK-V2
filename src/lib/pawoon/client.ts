import {
  PAWOON_BASE_URL,
  PAWOON_REQUEST_TIMEOUT_MS,
  PAWOON_RETRY_DELAYS_MS,
} from './endpoints';
import { clearPawoonTokenCache, getPawoonAccessToken } from './oauth';

interface FetchPawoonOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  // Skip retry — useful for short-circuit health checks.
  noRetry?: boolean;
}

function buildUrl(path: string, query?: FetchPawoonOptions['query']): string {
  const url = new URL(path, PAWOON_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPawoon<T>(
  path: string,
  options: FetchPawoonOptions = {},
): Promise<T> {
  const { method = 'GET', query, body, noRetry = false } = options;
  const url = buildUrl(path, query);

  let lastError: unknown = null;
  const attempts = noRetry ? 1 : PAWOON_RETRY_DELAYS_MS.length + 1;
  let tokenRefreshed = false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(PAWOON_RETRY_DELAYS_MS[attempt - 1] ?? PAWOON_RETRY_DELAYS_MS.at(-1)!);
    }

    const token = await getPawoonAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAWOON_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Token might be revoked — refresh once then retry.
      if (response.status === 401 && !tokenRefreshed) {
        tokenRefreshed = true;
        clearPawoonTokenCache();
        await getPawoonAccessToken(true);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(
          `Pawoon ${method} ${path} failed ${response.status}: ${text.slice(0, 300)}`,
        );
        if (shouldRetry(response.status) && !noRetry && attempt < attempts - 1) {
          lastError = error;
          continue;
        }
        throw error;
      }

      // Some Pawoon endpoints return text/plain on empty body.
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return undefined as T;
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetworkLike = err instanceof TypeError;
      if ((isAbort || isNetworkLike) && !noRetry && attempt < attempts - 1) {
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`Pawoon ${method} ${path} failed after ${attempts} attempts`);
}

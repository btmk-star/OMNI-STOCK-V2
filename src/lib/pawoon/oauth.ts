import { PAWOON_BASE_URL, PAWOON_PATHS, PAWOON_REQUEST_TIMEOUT_MS } from './endpoints';
import type { PawoonOAuthTokenResponse } from './types';

interface CachedToken {
  token: string;
  expiresAt: number; // ms epoch
}

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

const REFRESH_BUFFER_MS = 60_000; // refresh 1 menit sebelum expire

function isExpired(token: CachedToken | null): token is null {
  return token === null || token.expiresAt - Date.now() < REFRESH_BUFFER_MS;
}

async function requestToken(): Promise<string> {
  const appId = process.env.PAWOON_APP_ID;
  const secretKey = process.env.PAWOON_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new Error('PAWOON_APP_ID and PAWOON_SECRET_KEY must be set');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAWOON_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${PAWOON_BASE_URL}${PAWOON_PATHS.oauthToken}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: secretKey,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Pawoon OAuth failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const json = (await response.json()) as PawoonOAuthTokenResponse;
    if (!json.access_token || !json.expires_in) {
      throw new Error('Pawoon OAuth response missing access_token or expires_in');
    }

    cached = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPawoonAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && !isExpired(cached)) {
    return cached.token;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      return await requestToken();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearPawoonTokenCache(): void {
  cached = null;
}

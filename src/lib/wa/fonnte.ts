import type { WaSendInput, WaSendResult } from './types';

const FONNTE_BASE = 'https://api.fonnte.com';

export async function fonnteSend(input: WaSendInput): Promise<WaSendResult> {
  const token = process.env.FONNTE_API_KEY;
  if (!token) {
    return {
      ok: false,
      provider: 'fonnte',
      rawResponse: null,
      errorMessage: 'FONNTE_API_KEY belum dikonfigurasi',
    };
  }

  const formData = new URLSearchParams();
  formData.set('target', input.to);
  formData.set('message', input.message);
  formData.set('countryCode', '62');

  try {
    const response = await fetch(`${FONNTE_BASE}/send`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as {
      status?: boolean;
      id?: string[];
      detail?: string;
      reason?: string;
      process?: string;
    };

    if (!response.ok || data.status === false) {
      return {
        ok: false,
        provider: 'fonnte',
        rawResponse: data,
        errorMessage:
          data.detail ?? data.reason ?? `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: 'fonnte',
      providerMessageId: Array.isArray(data.id) ? data.id[0] : undefined,
      rawResponse: data,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'fonnte',
      rawResponse: null,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function fonnteDeviceStatus(): Promise<{
  connected: boolean;
  device?: string;
  raw: unknown;
}> {
  const token = process.env.FONNTE_API_KEY;
  if (!token) return { connected: false, raw: null };
  try {
    const response = await fetch(`${FONNTE_BASE}/device`, {
      method: 'POST',
      headers: { Authorization: token },
    });
    const data = (await response.json()) as { device?: string; status?: string };
    return {
      connected: data.status === 'connect',
      device: data.device,
      raw: data,
    };
  } catch (err) {
    return { connected: false, raw: err instanceof Error ? err.message : null };
  }
}

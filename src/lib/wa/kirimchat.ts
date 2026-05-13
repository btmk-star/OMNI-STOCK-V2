import type { WaSendInput, WaSendResult } from './types';

const KIRIMCHAT_BASE = 'https://api.kirim.chat/api/v1';

export async function kirimchatSend(input: WaSendInput): Promise<WaSendResult> {
  const token = process.env.KIRIMCHAT_API_KEY;
  if (!token) {
    return {
      ok: false,
      provider: 'kirimchat',
      rawResponse: null,
      errorMessage: 'KIRIMCHAT_API_KEY belum dikonfigurasi',
    };
  }

  try {
    const response = await fetch(`${KIRIMCHAT_BASE}/send-message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: input.to,
        message: input.message,
      }),
    });

    const data = (await response.json()) as {
      status?: string | boolean;
      success?: boolean;
      message_id?: string;
      message?: string;
      error?: string;
    };

    const success =
      data.success === true || data.status === true || data.status === 'success';
    if (!response.ok || !success) {
      return {
        ok: false,
        provider: 'kirimchat',
        rawResponse: data,
        errorMessage:
          data.error ?? data.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: 'kirimchat',
      providerMessageId: data.message_id,
      rawResponse: data,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'kirimchat',
      rawResponse: null,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}

import { fonnteSend } from './fonnte';
import { kirimchatSend } from './kirimchat';
import { normalizePhone, type WaProvider, type WaSendInput, type WaSendResult } from './types';

export { normalizePhone };
export type { WaProvider, WaSendInput, WaSendResult };

export function availableProviders(): WaProvider[] {
  const out: WaProvider[] = [];
  if (process.env.FONNTE_API_KEY) out.push('fonnte');
  if (process.env.KIRIMCHAT_API_KEY) out.push('kirimchat');
  return out;
}

export async function sendWhatsApp(
  provider: WaProvider,
  input: WaSendInput,
): Promise<WaSendResult> {
  const phone = normalizePhone(input.to);
  if (!phone) {
    return {
      ok: false,
      provider,
      rawResponse: null,
      errorMessage: 'Nomor WhatsApp tidak valid',
    };
  }
  const payload: WaSendInput = { ...input, to: phone };
  if (provider === 'fonnte') return fonnteSend(payload);
  if (provider === 'kirimchat') return kirimchatSend(payload);
  return {
    ok: false,
    provider,
    rawResponse: null,
    errorMessage: `Provider tidak dikenal: ${provider}`,
  };
}

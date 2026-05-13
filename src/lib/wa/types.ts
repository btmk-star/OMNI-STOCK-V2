export type WaProvider = 'fonnte' | 'kirimchat';

export interface WaSendInput {
  to: string; // Phone number, ID format (62...) without +
  message: string;
}

export interface WaSendResult {
  ok: boolean;
  provider: WaProvider;
  providerMessageId?: string;
  rawResponse: unknown;
  errorMessage?: string;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  // Convert 08xx → 628xx (Indonesia)
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

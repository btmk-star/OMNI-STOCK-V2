'use server';

import { revalidatePath } from 'next/cache';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

interface SyncResponse {
  success: boolean;
  records_synced?: number;
  duration_ms?: number;
  error?: string;
}

async function triggerCron(path: string): Promise<ActionResult<SyncResponse>> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { error: 'CRON_SECRET tidak terkonfigurasi di server' };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    const response = await fetch(`${appUrl}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
    const data = (await response.json()) as SyncResponse;
    if (!response.ok || data.success === false) {
      return { error: data.error ?? `Sync failed (HTTP ${response.status})` };
    }
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function triggerProductSync(): Promise<ActionResult<SyncResponse>> {
  const result = await triggerCron('/api/v2/cron/pawoon-product-sync');
  if ('data' in result) revalidatePath('/products');
  return result;
}

export async function triggerStockCardSync(): Promise<ActionResult<SyncResponse>> {
  const result = await triggerCron('/api/v2/cron/pawoon-stock-card-sync');
  if ('data' in result) revalidatePath('/inventory/stock-card');
  return result;
}

export async function triggerTransactionSync(): Promise<ActionResult<SyncResponse>> {
  const result = await triggerCron('/api/v2/cron/pawoon-transaction-sync');
  if ('data' in result) revalidatePath('/products');
  return result;
}

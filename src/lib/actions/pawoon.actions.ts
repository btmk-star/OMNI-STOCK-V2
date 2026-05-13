'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import {
  runProductSync,
  runStockCardSync,
  runTransactionSync,
  type SyncResult,
} from '@/lib/pawoon/sync-runners';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

async function authorize(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  // Pawoon sync masuk kategori inventory.full (admin/manager/spv/senior_staff)
  if (!hasPermission(profile?.role ?? null, 'inventory.full')) {
    return { error: 'Role kamu tidak punya akses untuk trigger sync' };
  }
  return { ok: true };
}

async function runWithAuth(
  runner: () => Promise<SyncResult>,
  invalidatePath: string,
): Promise<ActionResult<SyncResult>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const result = await runner();
  if (!result.success) {
    return { error: result.error ?? 'Sync gagal' };
  }
  revalidatePath(invalidatePath);
  revalidatePath('/settings');
  return { data: result };
}

export async function triggerProductSync() {
  return runWithAuth(runProductSync, '/products');
}

export async function triggerStockCardSync() {
  return runWithAuth(runStockCardSync, '/inventory/stock-card');
}

export async function triggerTransactionSync() {
  return runWithAuth(runTransactionSync, '/products');
}

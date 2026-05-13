'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const OpnameSchema = z.object({
  bahan_id: z.string().trim().min(1).max(20),
  outlet_id: z.string().trim().max(50).optional().nullable(),
  qty_after: z.number().min(0, 'Stok opname tidak boleh negatif'),
  reason: z.string().trim().max(2000).optional().nullable(),
});

const AdjustmentSchema = z.object({
  bahan_id: z.string().trim().min(1).max(20),
  outlet_id: z.string().trim().max(50).optional().nullable(),
  adjustment_type: z.enum(['reconciliation', 'manual', 'damage', 'transfer']),
  qty_diff: z.number(),
  reason: z.string().trim().min(2, 'Alasan wajib diisi').max(2000),
});

export type OpnameInput = z.infer<typeof OpnameSchema>;
export type AdjustmentInputForm = z.infer<typeof AdjustmentSchema>;

async function authorize(): Promise<{ ok: { userId: string } } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  if (!hasPermission(profile?.role ?? null, 'inventory.full')) {
    return { error: 'Role kamu tidak punya akses kelola stok' };
  }
  return { ok: { userId: userData.user.id } };
}

export async function recordStockOpname(
  input: OpnameInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = OpnameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  // Fetch qty_before dari last opname (untuk audit, optional)
  const { data: lastOpname } = await supabase
    .from('os_stock_adjustments')
    .select('qty_after')
    .eq('bahan_id', parsed.data.bahan_id)
    .eq('adjustment_type', 'opname')
    .order('adjusted_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ qty_after: number | null }>();

  const qtyBefore = lastOpname?.qty_after ?? null;
  const qtyDiff = qtyBefore != null ? parsed.data.qty_after - qtyBefore : null;

  const { data: inserted, error } = await supabase
    .from('os_stock_adjustments')
    .insert({
      bahan_id: parsed.data.bahan_id,
      outlet_id: parsed.data.outlet_id ?? null,
      adjustment_type: 'opname',
      qty_before: qtyBefore,
      qty_after: parsed.data.qty_after,
      qty_diff: qtyDiff,
      reason: parsed.data.reason ?? null,
      adjusted_by: auth.ok.userId,
      adjusted_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return { error: error.message };
  revalidatePath('/inventory/stok-bahan');
  revalidatePath('/inventory/master-bahan');
  return { data: { id: inserted!.id } };
}

export async function recordAdjustment(
  input: AdjustmentInputForm,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = AdjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from('os_stock_adjustments')
    .insert({
      bahan_id: parsed.data.bahan_id,
      outlet_id: parsed.data.outlet_id ?? null,
      adjustment_type: parsed.data.adjustment_type,
      qty_before: null,
      qty_after: null,
      qty_diff: parsed.data.qty_diff,
      reason: parsed.data.reason,
      adjusted_by: auth.ok.userId,
      adjusted_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return { error: error.message };
  revalidatePath('/inventory/stok-bahan');
  return { data: { id: inserted!.id } };
}

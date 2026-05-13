'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { parseOpnameWorkbook } from '@/lib/utils/parse-opname-xls';

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

export interface BulkPreviewMatched {
  source_row: number;
  source_name: string | null;
  bahan_id: string;
  bahan_name: string;
  current_baseline: number | null;
  new_qty: number;
  delta: number | null;
}

export interface BulkPreviewUnmatched {
  source_row: number;
  source_id: string | null;
  source_name: string | null;
  source_qty: number | null;
}

export interface BulkPreviewResult {
  matched: BulkPreviewMatched[];
  unmatched: BulkPreviewUnmatched[];
  detected_columns: { id?: string; name?: string; qty?: string; outlet?: string };
  warnings: string[];
  total_data_rows: number;
  source_filename: string;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function previewBulkOpname(
  formData: FormData,
): Promise<ActionResult<BulkPreviewResult>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return { error: 'File tidak ditemukan di form' };
  }
  if (file.size === 0) return { error: 'File kosong' };
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File terlalu besar (max 5 MB)' };
  }

  const buffer = await file.arrayBuffer();
  const parsed = parseOpnameWorkbook(buffer);

  if (parsed.rows.length === 0) {
    return {
      error:
        parsed.warnings[0] ??
        'File tidak punya baris data. Pastikan ada header di baris 1 dan data di baris 2+.',
    };
  }

  const supabase = await createClient();
  const { data: bahanRaw } = await supabase
    .from('os_bahan_baku')
    .select('id,name')
    .eq('is_active', true)
    .limit(5000);
  const bahanList = (bahanRaw ?? []) as Array<{ id: string; name: string }>;

  const byId = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string }>();
  for (const b of bahanList) {
    byId.set(b.id.toLowerCase().trim(), b);
    byName.set(normalizeName(b.name), b);
  }

  const matched: BulkPreviewMatched[] = [];
  const unmatched: BulkPreviewUnmatched[] = [];

  for (const r of parsed.rows) {
    // Skip baris yang qty-nya null/invalid
    if (r.source_qty == null || r.source_qty < 0) {
      unmatched.push({
        source_row: r.source_row,
        source_id: r.source_id,
        source_name: r.source_name,
        source_qty: r.source_qty,
      });
      continue;
    }

    let hit: { id: string; name: string } | undefined;
    if (r.source_id) hit = byId.get(r.source_id.toLowerCase().trim());
    if (!hit && r.source_name) hit = byName.get(normalizeName(r.source_name));

    if (!hit) {
      unmatched.push({
        source_row: r.source_row,
        source_id: r.source_id,
        source_name: r.source_name,
        source_qty: r.source_qty,
      });
      continue;
    }

    matched.push({
      source_row: r.source_row,
      source_name: r.source_name,
      bahan_id: hit.id,
      bahan_name: hit.name,
      current_baseline: null, // diisi di bawah via bulk fetch
      new_qty: r.source_qty,
      delta: null,
    });
  }

  // Bulk fetch current baseline untuk semua matched bahan
  if (matched.length > 0) {
    const matchedIds = [...new Set(matched.map((m) => m.bahan_id))];
    const { data: opnameRaw } = await supabase
      .from('os_stock_adjustments')
      .select('bahan_id,qty_after,adjusted_at')
      .eq('adjustment_type', 'opname')
      .in('bahan_id', matchedIds)
      .order('adjusted_at', { ascending: false });
    const lastOpnameByBahan = new Map<string, number>();
    for (const o of (opnameRaw ?? []) as Array<{
      bahan_id: string;
      qty_after: number | null;
    }>) {
      if (!lastOpnameByBahan.has(o.bahan_id) && o.qty_after != null) {
        lastOpnameByBahan.set(o.bahan_id, Number(o.qty_after));
      }
    }
    for (const m of matched) {
      const baseline = lastOpnameByBahan.get(m.bahan_id);
      if (baseline != null) {
        m.current_baseline = baseline;
        m.delta = Math.round((m.new_qty - baseline) * 1000) / 1000;
      }
    }
  }

  return {
    data: {
      matched,
      unmatched,
      detected_columns: parsed.detected_columns,
      warnings: parsed.warnings,
      total_data_rows: parsed.total_data_rows,
      source_filename: file.name,
    },
  };
}

const CommitRowSchema = z.object({
  bahan_id: z.string().trim().min(1).max(20),
  qty_after: z.number().min(0),
  outlet_id: z.string().trim().max(50).optional().nullable(),
  current_baseline: z.number().nullable().optional(),
});

const CommitSchema = z.object({
  rows: z.array(CommitRowSchema).min(1, 'Tidak ada baris untuk di-commit'),
  source_filename: z.string().trim().max(255),
});

export type CommitBulkOpnameInput = z.infer<typeof CommitSchema>;

export async function commitBulkOpname(
  input: CommitBulkOpnameInput,
): Promise<ActionResult<{ inserted: number; failed: Array<{ bahan_id: string; error: string }> }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = CommitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const reason = `Bulk import dari ${parsed.data.source_filename}`;
  const adjustedAt = new Date().toISOString();
  const userId = auth.ok.userId;

  let inserted = 0;
  const failed: Array<{ bahan_id: string; error: string }> = [];

  for (const row of parsed.data.rows) {
    const qtyBefore = row.current_baseline ?? null;
    const qtyDiff = qtyBefore != null ? row.qty_after - qtyBefore : null;
    const { error } = await supabase.from('os_stock_adjustments').insert({
      bahan_id: row.bahan_id,
      outlet_id: row.outlet_id ?? null,
      adjustment_type: 'opname',
      qty_before: qtyBefore,
      qty_after: row.qty_after,
      qty_diff: qtyDiff,
      reason,
      adjusted_by: userId,
      adjusted_at: adjustedAt,
    });
    if (error) {
      failed.push({ bahan_id: row.bahan_id, error: error.message });
    } else {
      inserted += 1;
    }
  }

  revalidatePath('/inventory/stok-bahan');
  revalidatePath('/inventory/master-bahan');
  return { data: { inserted, failed } };
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

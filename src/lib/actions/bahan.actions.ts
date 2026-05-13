'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const BahanSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  tipe: z.enum(['packaged', 'raw_bulk']),
  kategori: z.string().trim().max(100).optional().nullable(),
  outlet_id: z.string().trim().max(20).optional().nullable(),
  supplier_id: z.string().trim().max(20).optional().nullable(),
  kemasan_beli: z.string().trim().max(50).optional().nullable(),
  satuan_dapur: z.string().trim().max(20).optional().nullable(),
  min_stok: z.number().min(0).optional().nullable(),
  min_stok_unit: z.string().trim().max(20).optional().nullable(),
  harga_beli: z.number().min(0).optional().nullable(),
  isi_yield: z.number().min(0).optional().nullable(),
});

export type BahanInput = z.infer<typeof BahanSchema>;

async function authorize(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  if (!hasPermission(profile?.role ?? null, 'inventory.full')) {
    return { error: 'Role kamu tidak punya akses untuk kelola bahan' };
  }
  return { ok: true };
}

function calcHargaPerPorsi(harga_beli: number | null, isi_yield: number | null): number | null {
  if (harga_beli == null || isi_yield == null || isi_yield <= 0) return null;
  return Math.round((harga_beli / isi_yield) * 100) / 100;
}

function normalize(input: BahanInput) {
  const empty = (v?: string | null) => (v == null || v.trim() === '' ? null : v.trim());
  return {
    name: input.name.trim(),
    tipe: input.tipe,
    kategori: empty(input.kategori),
    outlet_id: empty(input.outlet_id),
    supplier_id: empty(input.supplier_id),
    kemasan_beli: empty(input.kemasan_beli),
    satuan_dapur: empty(input.satuan_dapur),
    min_stok: input.min_stok ?? null,
    min_stok_unit: empty(input.min_stok_unit),
    harga_beli: input.harga_beli ?? null,
    isi_yield: input.isi_yield ?? null,
    harga_per_porsi: calcHargaPerPorsi(input.harga_beli ?? null, input.isi_yield ?? null),
  };
}

async function generateBahanId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_bahan_baku')
    .select('id')
    .like('id', 'BHN-%')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = /^BHN-(\d+)$/.exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `BHN-${String(next).padStart(5, '0')}`;
}

export async function createBahan(input: BahanInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = BahanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const id = await generateBahanId();
  const { error } = await supabase
    .from('os_bahan_baku')
    .insert({ id, ...normalize(parsed.data), is_active: true });
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-bahan');
  return { data: { id } };
}

export async function updateBahan(
  id: string,
  input: BahanInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = BahanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('os_bahan_baku')
    .update({ ...normalize(parsed.data), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-bahan');
  return { data: { id } };
}

export async function toggleBahanActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from('os_bahan_baku')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-bahan');
  return { data: { id } };
}

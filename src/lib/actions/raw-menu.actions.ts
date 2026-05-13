'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const RawMenuItemSchema = z.object({
  bahan_id: z.string().trim().min(1, 'Bahan wajib dipilih').max(20),
  qty: z.number().min(0, 'Qty tidak boleh negatif'),
  satuan: z.string().trim().max(20).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  sort_order: z.number().int().min(0).optional().nullable(),
});

const RawMenuSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  satuan_hasil: z.string().trim().max(50).optional().nullable(),
  jumlah_hasil: z.number().min(0.001, 'Jumlah hasil harus > 0'),
  items: z.array(RawMenuItemSchema).min(1, 'Minimal 1 item bahan'),
});

export type RawMenuInput = z.infer<typeof RawMenuSchema>;
export type RawMenuItemInput = z.infer<typeof RawMenuItemSchema>;

async function authorize(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  if (!hasPermission(profile?.role ?? null, 'recipes.edit')) {
    return { error: 'Role kamu tidak punya akses untuk kelola raw menu' };
  }
  return { ok: true };
}

async function generateRawMenuId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_raw_menu')
    .select('id')
    .like('id', 'RM-%')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = /^RM-(\d+)$/.exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `RM-${String(next).padStart(4, '0')}`;
}

function sumCost(items: RawMenuItemInput[]): number {
  return items.reduce((s, it) => s + (it.cost ?? 0), 0);
}

export async function createRawMenu(
  input: RawMenuInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = RawMenuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const id = await generateRawMenuId();
  const total_cogs = sumCost(parsed.data.items);
  const cogs_per_unit = total_cogs / parsed.data.jumlah_hasil;

  const { error: headerErr } = await supabase.from('os_raw_menu').insert({
    id,
    name: parsed.data.name.trim(),
    satuan_hasil: parsed.data.satuan_hasil?.trim() || null,
    jumlah_hasil: parsed.data.jumlah_hasil,
    total_cogs,
    cogs_per_unit,
    is_active: true,
  });
  if (headerErr) return { error: headerErr.message };

  const itemsPayload = parsed.data.items.map((it, idx) => ({
    raw_menu_id: id,
    bahan_id: it.bahan_id,
    qty: it.qty,
    satuan: it.satuan?.trim() || null,
    cost: it.cost ?? null,
    sort_order: it.sort_order ?? idx,
  }));
  const { error: itemsErr } = await supabase.from('os_raw_menu_items').insert(itemsPayload);
  if (itemsErr) {
    await supabase.from('os_raw_menu').delete().eq('id', id);
    return { error: `Items insert gagal: ${itemsErr.message}` };
  }

  revalidatePath('/inventory/raw-menu');
  return { data: { id } };
}

export async function updateRawMenu(
  id: string,
  input: RawMenuInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = RawMenuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const total_cogs = sumCost(parsed.data.items);
  const cogs_per_unit = total_cogs / parsed.data.jumlah_hasil;

  const { error: headerErr } = await supabase
    .from('os_raw_menu')
    .update({
      name: parsed.data.name.trim(),
      satuan_hasil: parsed.data.satuan_hasil?.trim() || null,
      jumlah_hasil: parsed.data.jumlah_hasil,
      total_cogs,
      cogs_per_unit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (headerErr) return { error: headerErr.message };

  const { error: deleteErr } = await supabase
    .from('os_raw_menu_items')
    .delete()
    .eq('raw_menu_id', id);
  if (deleteErr) return { error: `Items reset gagal: ${deleteErr.message}` };

  const itemsPayload = parsed.data.items.map((it, idx) => ({
    raw_menu_id: id,
    bahan_id: it.bahan_id,
    qty: it.qty,
    satuan: it.satuan?.trim() || null,
    cost: it.cost ?? null,
    sort_order: it.sort_order ?? idx,
  }));
  const { error: itemsErr } = await supabase.from('os_raw_menu_items').insert(itemsPayload);
  if (itemsErr) return { error: `Items insert gagal: ${itemsErr.message}` };

  revalidatePath('/inventory/raw-menu');
  revalidatePath(`/inventory/raw-menu/${id}`);
  return { data: { id } };
}

export async function getRawMenuItems(
  id: string,
): Promise<ActionResult<RawMenuItemInput[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_raw_menu_items')
    .select('bahan_id,qty,satuan,cost,sort_order')
    .eq('raw_menu_id', id)
    .order('sort_order');
  if (error) return { error: error.message };
  return {
    data: (data ?? []).map((it) => ({
      bahan_id: it.bahan_id as string,
      qty: Number(it.qty),
      satuan: (it.satuan as string | null) ?? null,
      cost: it.cost != null ? Number(it.cost) : null,
      sort_order: (it.sort_order as number | null) ?? 0,
    })),
  };
}

export async function toggleRawMenuActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from('os_raw_menu')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/raw-menu');
  return { data: { id } };
}

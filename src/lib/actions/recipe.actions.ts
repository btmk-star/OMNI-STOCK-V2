'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const RecipeItemSchema = z
  .object({
    item_type: z.enum(['bahan', 'raw_menu']),
    bahan_id: z.string().trim().max(20).optional().nullable(),
    raw_menu_id: z.string().trim().max(20).optional().nullable(),
    qty: z.number().min(0),
    satuan: z.string().trim().max(20).optional().nullable(),
    cost: z.number().min(0).optional().nullable(),
    sort_order: z.number().int().min(0).optional().nullable(),
  })
  .refine(
    (it) =>
      (it.item_type === 'bahan' && !!it.bahan_id) ||
      (it.item_type === 'raw_menu' && !!it.raw_menu_id),
    { message: 'Item harus pilih bahan ATAU raw menu' },
  );

const RecipeSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  menu_id: z.string().trim().max(20).optional().nullable(),
  satuan_hasil: z.string().trim().max(50).optional().nullable(),
  jumlah_hasil: z.number().min(0.001, 'Jumlah hasil harus > 0'),
  items: z.array(RecipeItemSchema).min(1, 'Minimal 1 item'),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;
export type RecipeItemInput = z.infer<typeof RecipeItemSchema>;

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
    return { error: 'Role kamu tidak punya akses untuk kelola resep' };
  }
  return { ok: true };
}

async function generateRecipeId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_recipes')
    .select('id')
    .like('id', 'RCP-%')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = /^RCP-(\d+)$/.exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `RCP-${String(next).padStart(5, '0')}`;
}

function sumCost(items: RecipeItemInput[]): number {
  return items.reduce((s, it) => s + (it.cost ?? 0), 0);
}

function buildItemsPayload(recipeId: string, items: RecipeItemInput[]) {
  return items.map((it, idx) => ({
    recipe_id: recipeId,
    bahan_id: it.item_type === 'bahan' ? it.bahan_id : null,
    raw_menu_id: it.item_type === 'raw_menu' ? it.raw_menu_id : null,
    qty: it.qty,
    satuan: it.satuan?.trim() || null,
    cost: it.cost ?? null,
    sort_order: it.sort_order ?? idx,
  }));
}

async function syncMenuLink(
  recipeId: string,
  menuId: string | null | undefined,
  totalCogs: number,
) {
  const supabase = await createClient();
  if (menuId) {
    await supabase
      .from('os_master_menu')
      .update({ recipe_id: recipeId, total_cogs: totalCogs, updated_at: new Date().toISOString() })
      .eq('id', menuId);
    // Recalc margin if harga_jual exists
    const { data: menu } = await supabase
      .from('os_master_menu')
      .select('harga_jual')
      .eq('id', menuId)
      .maybeSingle<{ harga_jual: number | null }>();
    if (menu?.harga_jual && menu.harga_jual > 0) {
      const margin = Math.round(((menu.harga_jual - totalCogs) / menu.harga_jual) * 10000) / 100;
      await supabase.from('os_master_menu').update({ margin_pct: margin }).eq('id', menuId);
    }
  }
}

export async function createRecipe(input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = RecipeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const id = await generateRecipeId();
  const total_cogs = sumCost(parsed.data.items);
  const cogs_per_unit = total_cogs / parsed.data.jumlah_hasil;

  const { error: headerErr } = await supabase.from('os_recipes').insert({
    id,
    menu_id: parsed.data.menu_id?.trim() || null,
    name: parsed.data.name.trim(),
    satuan_hasil: parsed.data.satuan_hasil?.trim() || null,
    jumlah_hasil: parsed.data.jumlah_hasil,
    total_cogs,
    cogs_per_unit,
    is_active: true,
  });
  if (headerErr) return { error: headerErr.message };

  const { error: itemsErr } = await supabase
    .from('os_recipe_items')
    .insert(buildItemsPayload(id, parsed.data.items));
  if (itemsErr) {
    await supabase.from('os_recipes').delete().eq('id', id);
    return { error: `Items insert gagal: ${itemsErr.message}` };
  }

  await syncMenuLink(id, parsed.data.menu_id, total_cogs);
  revalidatePath('/inventory/master-resep');
  revalidatePath('/inventory/master-menu');
  return { data: { id } };
}

export async function updateRecipe(
  id: string,
  input: RecipeInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = RecipeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const total_cogs = sumCost(parsed.data.items);
  const cogs_per_unit = total_cogs / parsed.data.jumlah_hasil;

  const { error: headerErr } = await supabase
    .from('os_recipes')
    .update({
      menu_id: parsed.data.menu_id?.trim() || null,
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
    .from('os_recipe_items')
    .delete()
    .eq('recipe_id', id);
  if (deleteErr) return { error: `Items reset gagal: ${deleteErr.message}` };

  const { error: itemsErr } = await supabase
    .from('os_recipe_items')
    .insert(buildItemsPayload(id, parsed.data.items));
  if (itemsErr) return { error: `Items insert gagal: ${itemsErr.message}` };

  await syncMenuLink(id, parsed.data.menu_id, total_cogs);
  revalidatePath('/inventory/master-resep');
  revalidatePath(`/inventory/master-resep/${id}`);
  revalidatePath('/inventory/master-menu');
  return { data: { id } };
}

export async function getRecipeItems(
  id: string,
): Promise<ActionResult<RecipeItemInput[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_recipe_items')
    .select('bahan_id,raw_menu_id,qty,satuan,cost,sort_order')
    .eq('recipe_id', id)
    .order('sort_order');
  if (error) return { error: error.message };
  return {
    data: (data ?? []).map((it) => ({
      item_type: it.bahan_id ? 'bahan' : 'raw_menu',
      bahan_id: (it.bahan_id as string | null) ?? null,
      raw_menu_id: (it.raw_menu_id as string | null) ?? null,
      qty: Number(it.qty),
      satuan: (it.satuan as string | null) ?? null,
      cost: it.cost != null ? Number(it.cost) : null,
      sort_order: (it.sort_order as number | null) ?? 0,
    })),
  };
}

export async function toggleRecipeActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from('os_recipes')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-resep');
  return { data: { id } };
}

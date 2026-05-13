'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const MenuSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  kategori: z.string().trim().max(100).optional().nullable(),
  channel: z.string().trim().max(50).optional().nullable(),
  outlet_id: z.string().trim().max(20).optional().nullable(),
  recipe_id: z.string().trim().max(20).optional().nullable(),
  harga_jual: z.number().min(0).optional().nullable(),
  pawoon_product_id: z.string().trim().max(50).optional().nullable(),
});

export type MenuInput = z.infer<typeof MenuSchema>;

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
    return { error: 'Role kamu tidak punya akses untuk kelola menu' };
  }
  return { ok: true };
}

async function fetchRecipeCogs(
  recipeId: string | null | undefined,
): Promise<number | null> {
  if (!recipeId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_recipes')
    .select('total_cogs')
    .eq('id', recipeId)
    .maybeSingle<{ total_cogs: number | null }>();
  return data?.total_cogs ?? null;
}

function calcMargin(harga_jual: number | null, cogs: number | null): number | null {
  if (harga_jual == null || cogs == null || harga_jual <= 0) return null;
  return Math.round(((harga_jual - cogs) / harga_jual) * 10000) / 100;
}

function normalize(input: MenuInput) {
  const empty = (v?: string | null) => (v == null || v.trim() === '' ? null : v.trim());
  return {
    name: input.name.trim(),
    kategori: empty(input.kategori),
    channel: empty(input.channel),
    outlet_id: empty(input.outlet_id),
    recipe_id: empty(input.recipe_id),
    harga_jual: input.harga_jual ?? null,
    pawoon_product_id: empty(input.pawoon_product_id),
  };
}

async function generateMenuId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_master_menu')
    .select('id')
    .like('id', 'MNU-%')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = /^MNU-(\d+)$/.exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `MNU-${String(next).padStart(5, '0')}`;
}

export async function createMenu(input: MenuInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = MenuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const id = await generateMenuId();
  const cogs = await fetchRecipeCogs(parsed.data.recipe_id);
  const margin = calcMargin(parsed.data.harga_jual ?? null, cogs);
  const { error } = await supabase
    .from('os_master_menu')
    .insert({
      id,
      ...normalize(parsed.data),
      total_cogs: cogs,
      margin_pct: margin,
      is_active: true,
    });
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-menu');
  return { data: { id } };
}

export async function updateMenu(
  id: string,
  input: MenuInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const parsed = MenuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const cogs = await fetchRecipeCogs(parsed.data.recipe_id);
  const margin = calcMargin(parsed.data.harga_jual ?? null, cogs);
  const { error } = await supabase
    .from('os_master_menu')
    .update({
      ...normalize(parsed.data),
      total_cogs: cogs,
      margin_pct: margin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-menu');
  return { data: { id } };
}

export async function toggleMenuActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from('os_master_menu')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventory/master-menu');
  return { data: { id } };
}

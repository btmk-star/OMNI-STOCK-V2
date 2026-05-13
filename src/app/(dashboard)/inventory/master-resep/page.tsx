import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { RecipeTable, type RecipeRow } from './recipe-table';
import type {
  BahanOption,
  RawMenuOption,
  MenuOption,
} from './recipe-form-dialog';

const PAGE_SIZE = 25;

export default async function MasterResepPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; show?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (userData.user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single<{ role: Role }>();
    role = profile?.role ?? null;
  }
  const canManage = hasPermission(role, 'recipes.edit');

  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('os_recipes')
    .select(
      'id,menu_id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,is_active,os_master_menu(name)',
      { count: 'exact' },
    )
    .order('name')
    .range(from, to);

  if (params.show !== 'all') query = query.eq('is_active', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query;

  const [{ data: bahanList }, { data: rawList }, { data: menuList }] = await Promise.all([
    supabase
      .from('os_bahan_baku')
      .select('id,name,satuan_dapur,harga_per_porsi')
      .eq('is_active', true)
      .order('name')
      .limit(2000),
    supabase
      .from('os_raw_menu')
      .select('id,name,satuan_hasil,cogs_per_unit')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('os_master_menu')
      .select('id,name')
      .eq('is_active', true)
      .order('name')
      .limit(2000),
  ]);

  return (
    <RecipeTable
      initial={(data ?? []) as unknown as RecipeRow[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      showInactive={params.show === 'all'}
      bahanOptions={(bahanList ?? []) as BahanOption[]}
      rawMenuOptions={(rawList ?? []) as RawMenuOption[]}
      menuOptions={(menuList ?? []) as MenuOption[]}
      canManage={canManage}
      fetchError={error?.message ?? null}
    />
  );
}

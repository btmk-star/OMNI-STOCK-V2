import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { MenuTable, type MenuRow } from './menu-table';

const PAGE_SIZE = 25;

export default async function MasterMenuPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    outlet?: string;
    kategori?: string;
    channel?: string;
    pawoon?: string;
    page?: string;
    show?: string;
  }>;
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
    .from('os_master_menu')
    .select(
      'id,name,pawoon_product_id,channel,kategori,outlet_id,recipe_id,harga_jual,total_cogs,margin_pct,is_active,os_recipes(name)',
      { count: 'exact' },
    )
    .order('name')
    .range(from, to);

  if (params.show !== 'all') query = query.eq('is_active', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);
  if (params.outlet) query = query.eq('outlet_id', params.outlet);
  if (params.kategori) query = query.eq('kategori', params.kategori);
  if (params.channel) query = query.eq('channel', params.channel);
  if (params.pawoon === 'mapped') query = query.not('pawoon_product_id', 'is', null);
  if (params.pawoon === 'unmapped') query = query.is('pawoon_product_id', null);

  const { data, count, error } = await query;

  const [{ data: distinctRaw }, { data: recipeList }] = await Promise.all([
    supabase
      .from('os_master_menu')
      .select('outlet_id,kategori,channel')
      .eq('is_active', true),
    supabase
      .from('os_recipes')
      .select('id,name,total_cogs')
      .eq('is_active', true)
      .order('name'),
  ]);

  const outlets = [
    ...new Set((distinctRaw ?? []).map((r) => r.outlet_id as string).filter(Boolean)),
  ].sort();
  const kategoris = [
    ...new Set((distinctRaw ?? []).map((r) => r.kategori as string).filter(Boolean)),
  ].sort();
  const channels = [
    ...new Set((distinctRaw ?? []).map((r) => r.channel as string).filter(Boolean)),
  ].sort();
  const recipes = (recipeList ?? []) as Array<{
    id: string;
    name: string;
    total_cogs: number | null;
  }>;

  return (
    <MenuTable
      initial={(data ?? []) as unknown as MenuRow[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      outletFilter={params.outlet ?? ''}
      kategoriFilter={params.kategori ?? ''}
      channelFilter={params.channel ?? ''}
      pawoonFilter={params.pawoon ?? ''}
      showInactive={params.show === 'all'}
      distinctOutlets={outlets}
      distinctKategoris={kategoris}
      distinctChannels={channels}
      recipes={recipes}
      canManage={canManage}
      fetchError={error?.message ?? null}
    />
  );
}

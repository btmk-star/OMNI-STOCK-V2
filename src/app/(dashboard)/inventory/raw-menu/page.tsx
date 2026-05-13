import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { RawMenuTable, type RawMenuRow } from './raw-menu-table';
import type { BahanOption } from './raw-menu-form-dialog';

export default async function RawMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string }>;
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

  let query = supabase
    .from('os_raw_menu')
    .select(
      'id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,is_active,updated_at',
      { count: 'exact' },
    )
    .order('name');

  if (params.show !== 'all') query = query.eq('is_active', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query;

  const { data: bahanList } = await supabase
    .from('os_bahan_baku')
    .select('id,name,satuan_dapur,harga_per_porsi')
    .eq('is_active', true)
    .order('name')
    .limit(2000);

  return (
    <RawMenuTable
      initial={(data ?? []) as unknown as RawMenuRow[]}
      total={count ?? 0}
      query={params.q ?? ''}
      showInactive={params.show === 'all'}
      bahanOptions={(bahanList ?? []) as BahanOption[]}
      canManage={canManage}
      fetchError={error?.message ?? null}
    />
  );
}

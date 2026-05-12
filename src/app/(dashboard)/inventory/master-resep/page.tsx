import { createClient } from '@/lib/supabase/server';
import { RecipeTable, type RecipeRow } from './recipe-table';

const PAGE_SIZE = 25;

export default async function MasterResepPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('os_recipes')
    .select(
      'id,menu_id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,is_active,os_master_menu(name)',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .order('name')
    .range(from, to);

  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query;

  return (
    <RecipeTable
      initial={(data ?? []) as unknown as RecipeRow[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      fetchError={error?.message ?? null}
    />
  );
}

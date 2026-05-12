import { createClient } from '@/lib/supabase/server';
import { RawMenuTable, type RawMenuRow } from './raw-menu-table';

export default async function RawMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('os_raw_menu')
    .select(
      'id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,is_active,updated_at',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .order('name');

  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query;

  return (
    <RawMenuTable
      initial={(data ?? []) as unknown as RawMenuRow[]}
      total={count ?? 0}
      query={params.q ?? ''}
      fetchError={error?.message ?? null}
    />
  );
}

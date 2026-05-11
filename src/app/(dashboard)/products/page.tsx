import { createClient } from '@/lib/supabase/server';
import { ProductsTable, type ProductRow } from './products-table';

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('pawoon_products')
    .select('pawoon_id,name,category_name,price,sku,is_sold,outlet_ids,synced_at', {
      count: 'exact',
    })
    .order('name')
    .range(from, to);

  if (params.q) query = query.ilike('name', `%${params.q}%`);
  if (params.outlet) query = query.contains('outlet_ids', [params.outlet]);

  const { data, count, error } = await query;

  // Last successful sync untuk badge
  const { data: lastSync } = await supabase
    .from('pawoon_sync_log')
    .select('synced_at,records_synced,status')
    .eq('table_name', 'pawoon_products')
    .eq('status', 'success')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single<{ synced_at: string; records_synced: number; status: string }>();

  return (
    <ProductsTable
      initial={(data ?? []) as ProductRow[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      outletFilter={params.outlet ?? ''}
      lastSyncedAt={lastSync?.synced_at ?? null}
      lastSyncedCount={lastSync?.records_synced ?? null}
      fetchError={error?.message ?? null}
    />
  );
}

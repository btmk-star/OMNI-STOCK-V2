import { createClient } from '@/lib/supabase/server';
import { StockCardView, type StockCardRow } from './stock-card-view';

function todayInJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
}

export default async function StockCardPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; date?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const periodDate = params.date ?? todayInJakarta();

  let query = supabase
    .from('pawoon_stock_cards')
    .select(
      'pawoon_outlet_id,pawoon_product_id,period_date,stok_awal,masuk,keluar,penjualan,transfer,penyesuaian,stok_akhir,synced_at',
      { count: 'exact' },
    )
    .eq('period_date', periodDate)
    .order('pawoon_product_id')
    .limit(200);

  if (params.outlet) query = query.eq('pawoon_outlet_id', params.outlet);

  const { data, count, error } = await query;

  // Optional join: enrich dengan nama produk dari pawoon_products
  const productIds = (data ?? []).map((r) => r.pawoon_product_id);
  const { data: products } = productIds.length
    ? await supabase
        .from('pawoon_products')
        .select('pawoon_id,name')
        .in('pawoon_id', productIds)
    : { data: null };
  const productMap = new Map<string, string>();
  for (const p of (products ?? []) as Array<{ pawoon_id: string; name: string }>) {
    productMap.set(p.pawoon_id, p.name);
  }

  const rows: StockCardRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    pawoon_outlet_id: r.pawoon_outlet_id as string,
    pawoon_product_id: r.pawoon_product_id as string,
    product_name: productMap.get(r.pawoon_product_id as string) ?? null,
    period_date: r.period_date as string,
    stok_awal: Number(r.stok_awal ?? 0),
    masuk: Number(r.masuk ?? 0),
    keluar: Number(r.keluar ?? 0),
    penjualan: Number(r.penjualan ?? 0),
    transfer: Number(r.transfer ?? 0),
    penyesuaian: Number(r.penyesuaian ?? 0),
    stok_akhir: Number(r.stok_akhir ?? 0),
    synced_at: r.synced_at as string | null,
  }));

  const { data: lastSync } = await supabase
    .from('pawoon_sync_log')
    .select('synced_at,records_synced,status')
    .eq('table_name', 'pawoon_stock_cards')
    .eq('status', 'success')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single<{ synced_at: string; records_synced: number; status: string }>();

  return (
    <StockCardView
      initial={rows}
      total={count ?? 0}
      periodDate={periodDate}
      outletFilter={params.outlet ?? ''}
      lastSyncedAt={lastSync?.synced_at ?? null}
      lastSyncedCount={lastSync?.records_synced ?? null}
      fetchError={error?.message ?? null}
    />
  );
}

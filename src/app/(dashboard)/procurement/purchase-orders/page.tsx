import { createClient } from '@/lib/supabase/server';
import { POTable, type POHeader } from './po-table';

const PAGE_SIZE = 25;

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; supplier?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('os_purchase_orders')
    .select(
      'id,supplier_id,outlet_ids,status,total_amount,notes,created_by_name,ordered_at,expected_delivery,wa_sent_at,created_at,os_suppliers(name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (params.q) query = query.ilike('id', `%${params.q}%`);
  if (params.status) query = query.eq('status', params.status);
  if (params.supplier) query = query.eq('supplier_id', params.supplier);

  const { data, count, error } = await query;

  // Distinct suppliers (untuk filter dropdown)
  const { data: supplierList } = await supabase
    .from('os_suppliers')
    .select('id,name')
    .eq('is_active', true)
    .order('name');

  return (
    <POTable
      initial={(data ?? []) as unknown as POHeader[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      statusFilter={params.status ?? ''}
      supplierFilter={params.supplier ?? ''}
      suppliers={(supplierList ?? []) as Array<{ id: string; name: string }>}
      fetchError={error?.message ?? null}
    />
  );
}

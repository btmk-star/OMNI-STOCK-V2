import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { POTable, type POHeader } from './po-table';
import type { BahanOption, SupplierOption } from './po-form-dialog';

const PAGE_SIZE = 25;

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; supplier?: string; page?: string }>;
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
  const canCreate = hasPermission(role, 'po.create');

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

  const [{ data: supplierList }, { data: bahanList }, { data: outletList }] = await Promise.all([
    supabase
      .from('os_suppliers')
      .select('id,name,whatsapp')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('os_bahan_baku')
      .select('id,name,satuan_dapur,harga_beli')
      .eq('is_active', true)
      .order('name')
      .limit(2000),
    supabase
      .from('pawoon_outlets')
      .select('pawoon_id,name')
      .eq('is_active', true)
      .order('name'),
  ]);

  const outlets = (outletList ?? [])
    .map((o) => (o.pawoon_id as string) ?? (o.name as string))
    .filter(Boolean);

  return (
    <POTable
      initial={(data ?? []) as unknown as POHeader[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      statusFilter={params.status ?? ''}
      supplierFilter={params.supplier ?? ''}
      suppliers={(supplierList ?? []) as SupplierOption[]}
      bahanOptions={(bahanList ?? []) as BahanOption[]}
      outlets={outlets}
      canCreate={canCreate}
      fetchError={error?.message ?? null}
    />
  );
}

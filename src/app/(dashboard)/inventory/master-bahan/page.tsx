import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { BahanTable, type BahanRow } from './bahan-table';

const PAGE_SIZE = 25;

export default async function MasterBahanPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    outlet?: string;
    kategori?: string;
    tipe?: string;
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
  const canManage = hasPermission(role, 'inventory.full');

  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('os_bahan_baku')
    .select(
      'id,name,tipe,kategori,kemasan_beli,satuan_dapur,min_stok,min_stok_unit,harga_beli,isi_yield,harga_per_porsi,outlet_id,supplier_id,is_active,os_suppliers(name)',
      { count: 'exact' },
    )
    .order('name')
    .range(from, to);

  if (params.show !== 'all') query = query.eq('is_active', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);
  if (params.outlet) query = query.eq('outlet_id', params.outlet);
  if (params.kategori) query = query.eq('kategori', params.kategori);
  if (params.tipe) query = query.eq('tipe', params.tipe);

  const { data, count, error } = await query;

  // Distinct values + supplier list (untuk filter & form dropdown)
  const [{ data: kategoriList }, { data: outletList }, { data: supplierList }] =
    await Promise.all([
      supabase
        .from('os_bahan_baku')
        .select('kategori')
        .eq('is_active', true)
        .not('kategori', 'is', null)
        .order('kategori'),
      supabase
        .from('os_bahan_baku')
        .select('outlet_id')
        .eq('is_active', true)
        .not('outlet_id', 'is', null)
        .order('outlet_id'),
      supabase
        .from('os_suppliers')
        .select('id,name')
        .eq('is_active', true)
        .order('name'),
    ]);

  const distinctKategori = [
    ...new Set((kategoriList ?? []).map((r) => r.kategori as string).filter(Boolean)),
  ].sort();
  const distinctOutlet = [
    ...new Set((outletList ?? []).map((r) => r.outlet_id as string).filter(Boolean)),
  ].sort();
  const suppliers = (supplierList ?? []) as Array<{ id: string; name: string }>;

  return (
    <BahanTable
      initial={(data ?? []) as unknown as BahanRow[]}
      total={count ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      query={params.q ?? ''}
      outletFilter={params.outlet ?? ''}
      kategoriFilter={params.kategori ?? ''}
      tipeFilter={params.tipe ?? ''}
      showInactive={params.show === 'all'}
      distinctKategori={distinctKategori}
      distinctOutlet={distinctOutlet}
      suppliers={suppliers}
      canManage={canManage}
      fetchError={error?.message ?? null}
    />
  );
}

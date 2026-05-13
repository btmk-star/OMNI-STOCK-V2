import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import {
  buildBomMap,
  computeConsumption,
  computeStockPerBahan,
  type AdjustmentInput,
  type BahanInput,
  type ComputedStock,
  type MenuMapInput,
  type POItemInput,
  type RawMenuItemInput,
  type RawMenuMetaInput,
  type RecipeItemInput,
  type RecipeMetaInput,
  type TransactionInput,
} from '@/lib/utils/stock-compute';
import { StockBahanTable } from './stock-table';

export const dynamic = 'force-dynamic';

const DEFAULT_BASELINE_DAYS = 30; // Untuk bahan yang belum punya opname, hitung dari N hari ke belakang.

export default async function StokBahanPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; kategori?: string; status?: string }>;
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

  // 1. Master data — parallel
  const [
    { data: bahanRaw },
    { data: recipeRaw },
    { data: recipeItemRaw },
    { data: rawMenuRaw },
    { data: rawMenuItemRaw },
    { data: menuMapRaw },
    { data: outletList },
  ] = await Promise.all([
    supabase
      .from('os_bahan_baku')
      .select('id,name,outlet_id,kategori,satuan_dapur,min_stok,min_stok_unit,is_active')
      .eq('is_active', true)
      .order('name')
      .limit(2000),
    supabase
      .from('os_recipes')
      .select('id,jumlah_hasil')
      .eq('is_active', true),
    supabase
      .from('os_recipe_items')
      .select('recipe_id,bahan_id,raw_menu_id,qty'),
    supabase
      .from('os_raw_menu')
      .select('id,jumlah_hasil')
      .eq('is_active', true),
    supabase
      .from('os_raw_menu_items')
      .select('raw_menu_id,bahan_id,qty'),
    supabase
      .from('os_master_menu')
      .select('pawoon_product_id,recipe_id')
      .eq('is_active', true)
      .not('pawoon_product_id', 'is', null)
      .not('recipe_id', 'is', null),
    supabase
      .from('pawoon_outlets')
      .select('pawoon_id,name')
      .eq('is_active', true)
      .order('name'),
  ]);

  const allBahan = (bahanRaw ?? []) as unknown as Array<BahanInput & { min_stok_unit: string | null }>;
  const recipeMeta = ((recipeRaw ?? []) as Array<{ id: string; jumlah_hasil: number | string }>).map<RecipeMetaInput>(
    (r) => ({ recipe_id: r.id, jumlah_hasil: Number(r.jumlah_hasil) || 1 }),
  );
  const recipeItems = ((recipeItemRaw ?? []) as Array<{
    recipe_id: string;
    bahan_id: string | null;
    raw_menu_id: string | null;
    qty: number | string;
  }>).map<RecipeItemInput>((r) => ({
    recipe_id: r.recipe_id,
    bahan_id: r.bahan_id,
    raw_menu_id: r.raw_menu_id,
    qty: Number(r.qty) || 0,
  }));
  const rawMenuMeta = ((rawMenuRaw ?? []) as Array<{ id: string; jumlah_hasil: number | string }>).map<RawMenuMetaInput>(
    (r) => ({ raw_menu_id: r.id, jumlah_hasil: Number(r.jumlah_hasil) || 1 }),
  );
  const rawMenuItems = ((rawMenuItemRaw ?? []) as Array<{
    raw_menu_id: string;
    bahan_id: string | null;
    qty: number | string;
  }>)
    .filter((r) => r.bahan_id)
    .map<RawMenuItemInput>((r) => ({
      raw_menu_id: r.raw_menu_id,
      bahan_id: r.bahan_id!,
      qty: Number(r.qty) || 0,
    }));
  const menus: MenuMapInput[] = ((menuMapRaw ?? []) as Array<{
    pawoon_product_id: string;
    recipe_id: string | null;
  }>).map((m) => ({ pawoon_product_id: m.pawoon_product_id, recipe_id: m.recipe_id }));

  const bom = buildBomMap({
    recipes: recipeMeta,
    recipeItems,
    rawMenus: rawMenuMeta,
    rawMenuItems,
    menus,
  });

  // 2. Fetch latest opname per bahan (subquery in JS — simpler than SQL DISTINCT ON)
  const { data: adjRaw } = await supabase
    .from('os_stock_adjustments')
    .select('bahan_id,outlet_id,adjustment_type,qty_after,qty_diff,adjusted_at')
    .order('adjusted_at', { ascending: false });
  const allAdjustments = ((adjRaw ?? []) as unknown as AdjustmentInput[]) ?? [];

  // Latest opname per bahan
  const lastOpnameByBahan = new Map<string, AdjustmentInput>();
  for (const adj of allAdjustments) {
    if (adj.adjustment_type === 'opname' && !lastOpnameByBahan.has(adj.bahan_id)) {
      lastOpnameByBahan.set(adj.bahan_id, adj);
    }
  }

  // 3. Determine window: paling lama dari opname terakhir, atau N hari ke belakang
  const fallbackDate = new Date(Date.now() - DEFAULT_BASELINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Window start untuk fetch transaction+PO+adjustment: paling awal di antara semua last_opname (atau fallback)
  let windowStart = fallbackDate;
  for (const op of lastOpnameByBahan.values()) {
    if (op.adjusted_at < windowStart) windowStart = op.adjusted_at;
  }

  // 4. Fetch transactions (sejak windowStart) untuk konsumsi
  const { data: trxRaw } = await supabase
    .from('pawoon_transactions')
    .select('transaction_date,pawoon_outlet_id,items')
    .gte('transaction_date', windowStart)
    .order('transaction_date', { ascending: false })
    .limit(10000);
  const allTrx = ((trxRaw ?? []) as unknown as Array<{
    transaction_date: string;
    pawoon_outlet_id: string;
    items: unknown;
  }>).map<TransactionInput>((t) => {
    const rawItems = (Array.isArray(t.items) ? t.items : []) as Array<{
      product_id?: string;
      qty?: number | string;
    }>;
    return {
      transaction_date: t.transaction_date,
      pawoon_outlet_id: t.pawoon_outlet_id,
      items: rawItems
        .filter((it): it is { product_id: string; qty: number | string } => !!it && !!it.product_id)
        .map((it) => ({ product_id: String(it.product_id), qty: Number(it.qty) || 0 })),
    };
  });

  // 5. Fetch PO items received (sejak windowStart) — pakai os_purchase_orders.updated_at as proxy
  const { data: poRaw } = await supabase
    .from('os_po_items')
    .select(
      'bahan_id,qty_received,os_purchase_orders!inner(updated_at,status)',
    )
    .gt('qty_received', 0)
    .gte('os_purchase_orders.updated_at', windowStart);
  const allPoReceived = ((poRaw ?? []) as unknown as Array<{
    bahan_id: string;
    qty_received: number | string;
    os_purchase_orders: { updated_at: string };
  }>).map<POItemInput>((p) => ({
    bahan_id: p.bahan_id,
    qty_received: Number(p.qty_received) || 0,
    po_received_at: p.os_purchase_orders.updated_at,
  }));

  // 6. Per-bahan compute
  const bahanResults: Array<
    ComputedStock & { name: string; kategori: string | null; satuan_dapur: string | null; min_stok: number | null; min_stok_unit: string | null }
  > = [];

  for (const bahan of allBahan) {
    const lastOpname = lastOpnameByBahan.get(bahan.id) ?? null;
    const baselineDate = lastOpname?.adjusted_at ?? fallbackDate;

    // Filter trx sejak baseline; optionally per outlet (kalau bahan punya outlet_id)
    const relevantTrx = allTrx.filter((t) => {
      if (t.transaction_date < baselineDate) return false;
      if (bahan.outlet_id && t.pawoon_outlet_id !== bahan.outlet_id) return false;
      return true;
    });
    const consumed = computeConsumption(relevantTrx, bom).get(bahan.id) ?? 0;

    // PO received sejak baseline
    const received = allPoReceived
      .filter((p) => p.bahan_id === bahan.id && p.po_received_at >= baselineDate)
      .reduce((s, p) => s + p.qty_received, 0);

    // Adjustments sejak baseline (non-opname)
    const adjustmentsSinceBaseline = allAdjustments.filter(
      (a) => a.bahan_id === bahan.id && a.adjusted_at >= baselineDate,
    );

    const result = computeStockPerBahan(bahan, {
      consumption: consumed,
      received,
      adjustmentsSinceBaseline,
      lastOpname,
    });

    bahanResults.push({
      ...result,
      name: bahan.name,
      kategori: bahan.kategori,
      satuan_dapur: bahan.satuan_dapur,
      min_stok: bahan.min_stok,
      min_stok_unit: bahan.min_stok_unit,
    });
  }

  // 7. Apply filters
  let filtered = bahanResults;
  if (params.outlet) filtered = filtered.filter((b) => b.outlet_id === params.outlet);
  if (params.kategori) filtered = filtered.filter((b) => b.kategori === params.kategori);
  if (params.status) filtered = filtered.filter((b) => b.status === params.status);

  // 8. Aggregate counts
  const counts = {
    total: bahanResults.length,
    critical: bahanResults.filter((b) => b.status === 'critical').length,
    warning: bahanResults.filter((b) => b.status === 'warning').length,
    no_baseline: bahanResults.filter((b) => b.status === 'no_baseline').length,
  };

  const distinctKategori = Array.from(
    new Set(bahanResults.map((b) => b.kategori).filter(Boolean) as string[]),
  ).sort();
  const outlets = (outletList ?? [])
    .map((o) => {
      const id = (o.pawoon_id as string | null) ?? (o.name as string | null);
      const name = (o.name as string | null) ?? (o.pawoon_id as string | null);
      return { id: id ?? '', name: name ?? '' };
    })
    .filter((o) => o.id);

  return (
    <StockBahanTable
      rows={filtered}
      counts={counts}
      outlets={outlets}
      distinctKategori={distinctKategori}
      outletFilter={params.outlet ?? ''}
      kategoriFilter={params.kategori ?? ''}
      statusFilter={params.status ?? ''}
      canManage={canManage}
    />
  );
}

import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { ReportsView } from './reports-view';
import {
  groupByDay,
  groupBySession,
  jakartaDateKey,
  startOfDayJakarta,
  sumRevenue,
  topMenuByQty,
  type TrxLike,
} from '@/lib/utils/dashboard-aggregate';

const TRX_FETCH_LIMIT = 10000;

function defaultRange(): { from: string; to: string } {
  // Default: last 30 days dari hari ini (atau dari latest data, dihandle Server Component)
  const today = new Date();
  const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: jakartaDateKey(past), to: jakartaDateKey(today) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; outlet?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Resolve user role for RBAC
  const { data: userData } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (userData.user?.id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single<{ role: Role }>();
    role = profile?.role ?? null;
  }
  const canViewNominal = hasPermission(role, 'reports.full');
  const canViewPattern = hasPermission(role, 'reports.view');

  if (!canViewPattern) {
    return (
      <div className="rounded-xl bg-surface p-12 text-center shadow-card">
        <p className="text-base font-medium text-forest dark:text-cream">
          Akses ditolak
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Role kamu tidak punya permission `reports.view`. Hubungi admin.
        </p>
      </div>
    );
  }

  const fallback = defaultRange();
  const fromKey = params.from ?? fallback.from;
  const toKey = params.to ?? fallback.to;
  const fromDate = new Date(`${fromKey}T00:00:00+07:00`);
  const toDate = new Date(`${toKey}T23:59:59+07:00`);

  // Fetch transactions in range
  let trxQuery = supabase
    .from('pawoon_transactions')
    .select('transaction_date,total_amount,session,channel,items,pawoon_outlet_id')
    .gte('transaction_date', fromDate.toISOString())
    .lte('transaction_date', toDate.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(TRX_FETCH_LIMIT);

  if (params.outlet) trxQuery = trxQuery.eq('pawoon_outlet_id', params.outlet);

  const { data: trxRaw } = await trxQuery;
  const trxs = (trxRaw ?? []) as unknown as TrxLike[];

  // Outlets for filter dropdown
  const { data: outlets } = await supabase
    .from('pawoon_outlets')
    .select('pawoon_id,name')
    .eq('is_active', true)
    .order('name');

  // PO activity in range
  let poQuery = supabase
    .from('os_purchase_orders')
    .select('id,supplier_id,outlet_ids,status,total_amount,created_at,os_suppliers(name)', {
      count: 'exact',
    })
    .gte('created_at', fromDate.toISOString())
    .lte('created_at', toDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: poData, count: poCount } = await poQuery;

  // Aggregates
  const totalRevenue = sumRevenue(trxs);
  const dailySeries = groupByDay(trxs);
  const sessionSeries = groupBySession(trxs);
  const topMenu = topMenuByQty(trxs, 10);

  // Outlet breakdown
  const outletNameById = new Map<string, string>();
  for (const o of (outlets ?? []) as Array<{ pawoon_id: string; name: string }>) {
    outletNameById.set(o.pawoon_id, o.name);
  }
  const byOutlet = new Map<
    string,
    { outletId: string; outletName: string; trxCount: number; revenue: number }
  >();
  for (const t of trxs) {
    const id = t.pawoon_outlet_id;
    const existing = byOutlet.get(id);
    if (existing) {
      existing.trxCount += 1;
      existing.revenue += Number(t.total_amount ?? 0);
    } else {
      byOutlet.set(id, {
        outletId: id,
        outletName: outletNameById.get(id) ?? id,
        trxCount: 1,
        revenue: Number(t.total_amount ?? 0),
      });
    }
  }
  const outletBreakdown = [...byOutlet.values()].sort((a, b) => b.revenue - a.revenue);

  // PO summary by status
  type POSum = { status: string; count: number; total: number };
  const poByStatus = new Map<string, POSum>();
  for (const po of (poData ?? []) as Array<{
    status: string;
    total_amount: number | null;
  }>) {
    const existing = poByStatus.get(po.status);
    if (existing) {
      existing.count += 1;
      existing.total += Number(po.total_amount ?? 0);
    } else {
      poByStatus.set(po.status, {
        status: po.status,
        count: 1,
        total: Number(po.total_amount ?? 0),
      });
    }
  }
  const poSummary = [...poByStatus.values()];

  return (
    <ReportsView
      canViewNominal={canViewNominal}
      fromKey={fromKey}
      toKey={toKey}
      outletFilter={params.outlet ?? ''}
      outlets={(outlets ?? []) as Array<{ pawoon_id: string; name: string }>}
      totalRevenue={totalRevenue}
      totalTrx={trxs.length}
      dailySeries={dailySeries}
      sessionSeries={sessionSeries}
      topMenu={topMenu}
      outletBreakdown={outletBreakdown}
      poSummary={poSummary}
      poCount={poCount ?? 0}
    />
  );
}

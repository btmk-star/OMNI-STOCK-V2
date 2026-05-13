import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { DashboardCharts } from './dashboard-charts';
import { DashboardStats } from './dashboard-stats';
import { RecentPOTable, type RecentPORow } from './recent-po-table';
import {
  daysAgoJakarta,
  groupByDay,
  groupBySession,
  jakartaDateKey,
  latestTrxDate,
  startOfDayJakarta,
  sumRevenue,
  topMenuByQty,
  type TrxLike,
} from '@/lib/utils/dashboard-aggregate';

const TRX_FETCH_LIMIT = 5000;

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Resolve user role for RBAC nominal mask
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  let role: Role | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role,full_name')
      .eq('id', userId)
      .single<{ role: Role; full_name: string | null }>();
    role = profile?.role ?? null;
  }
  const canViewNominal = hasPermission(role, 'dashboard.view_nominal');

  // 2. Fetch transactions last 60 days dari latest available trx (data historis,
  //    bukan dari NOW). Server-side reduce ke aggregate per tujuan.
  const { data: latestRow } = await supabase
    .from('pawoon_transactions')
    .select('transaction_date')
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single<{ transaction_date: string }>();

  const anchor = latestRow ? new Date(latestRow.transaction_date) : new Date();
  const anchorStart = startOfDayJakarta(anchor);
  const sixtyDaysAgo = daysAgoJakarta(anchor, 60);

  const { data: trxRaw } = await supabase
    .from('pawoon_transactions')
    .select('transaction_date,total_amount,session,channel,items,pawoon_outlet_id')
    .gte('transaction_date', sixtyDaysAgo.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(TRX_FETCH_LIMIT);

  const trxs = (trxRaw ?? []) as unknown as TrxLike[];

  // 3. Window subsets
  const todayKey = jakartaDateKey(anchorStart);
  const day30Start = daysAgoJakarta(anchor, 30);
  const day7Start = daysAgoJakarta(anchor, 7);

  const trxToday = trxs.filter((t) => jakartaDateKey(t.transaction_date) === todayKey);
  const trx30 = trxs.filter((t) => new Date(t.transaction_date) >= day30Start);
  const trx7 = trxs.filter((t) => new Date(t.transaction_date) >= day7Start);

  // 4. Aggregates
  const revenueToday = sumRevenue(trxToday);
  const revenue7 = sumRevenue(trx7);
  const revenue30 = sumRevenue(trx30);
  const dailySeries = groupByDay(trx30);
  const sessionSeries = groupBySession(trx30);
  const topMenu = topMenuByQty(trx7, 5);

  // 5. Other counts (parallel queries)
  const [poCounts, outletCount] = await Promise.all([
    supabase
      .from('os_purchase_orders')
      .select('status', { count: 'exact', head: false })
      .in('status', ['submitted', 'approved', 'ordered', 'partial_received']),
    supabase
      .from('pawoon_outlets')
      .select('pawoon_id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  const poPendingCount = poCounts.count ?? 0;
  const outletsActive = outletCount.count ?? 0;

  // 6. Recent PO (last 5)
  const { data: recentPo } = await supabase
    .from('os_purchase_orders')
    .select('id,supplier_id,status,total_amount,created_at,os_suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Periode: 30 hari terakhir dari data ter-sync ·{' '}
          <span className="font-mono text-xs">
            anchor {jakartaDateKey(anchor)} ({trxs.length.toLocaleString('id-ID')} trx loaded)
          </span>
        </p>
      </header>

      <DashboardStats
        canViewNominal={canViewNominal}
        revenueToday={revenueToday}
        revenue7={revenue7}
        revenue30={revenue30}
        trxToday={trxToday.length}
        trx30={trx30.length}
        poPendingCount={poPendingCount}
        outletsActive={outletsActive}
      />

      <DashboardCharts
        canViewNominal={canViewNominal}
        dailySeries={dailySeries}
        sessionSeries={sessionSeries}
        topMenu={topMenu}
      />

      <RecentPOTable rows={(recentPo ?? []) as unknown as RecentPORow[]} />
    </div>
  );
}

import { TrendingUp, ShoppingBag, Store, Receipt } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface Props {
  canViewNominal: boolean;
  revenueToday: number;
  revenue7: number;
  revenue30: number;
  trxToday: number;
  trx30: number;
  poPendingCount: number;
  outletsActive: number;
}

export function DashboardStats({
  canViewNominal,
  revenueToday,
  revenue7,
  revenue30,
  trxToday,
  trx30,
  poPendingCount,
  outletsActive,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatsCard
        icon={<TrendingUp className="h-5 w-5 text-teal" strokeWidth={1.5} />}
        label="Revenue Hari Ini"
        value={canViewNominal ? formatCurrency(revenueToday) : '••••••'}
        hint={`${formatNumber(trxToday)} transaksi`}
      />
      <StatsCard
        icon={<TrendingUp className="h-5 w-5 text-teal" strokeWidth={1.5} />}
        label="Revenue 7 Hari"
        value={canViewNominal ? formatCurrency(revenue7) : '••••••'}
        hint={`Avg ${canViewNominal ? formatCurrency(Math.round(revenue7 / 7)) : '——'}/hari`}
      />
      <StatsCard
        icon={<Receipt className="h-5 w-5 text-teal" strokeWidth={1.5} />}
        label="Revenue 30 Hari"
        value={canViewNominal ? formatCurrency(revenue30) : '••••••'}
        hint={`${formatNumber(trx30)} transaksi`}
      />
      <StatsCard
        icon={<ShoppingBag className="h-5 w-5 text-teal" strokeWidth={1.5} />}
        label="PO Aktif"
        value={formatNumber(poPendingCount)}
        hint="submitted + approved + ordered"
      />
      <div className="col-span-2 lg:col-span-4">
        <div className="rounded-xl bg-mint/30 p-4 text-sm text-forest">
          <span className="inline-flex items-center gap-2 font-medium">
            <Store className="h-4 w-4 text-teal" strokeWidth={1.5} />
            {formatNumber(outletsActive)} outlet active · sync dari Pawoon + V1.6
          </span>
          {!canViewNominal ? (
            <span className="ml-3 text-xs text-text-muted">
              · Nominal disembunyikan untuk role kamu (kontak admin/manager untuk akses)
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-mint">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-midnight dark:text-cream">{value}</p>
      <p className="mt-1 text-[11px] text-text-muted">{hint}</p>
    </div>
  );
}

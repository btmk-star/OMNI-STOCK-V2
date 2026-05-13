'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Calendar, FileText, Loader2, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type DayPoint,
  type SessionPoint,
  type TopMenuPoint,
} from '@/lib/utils/dashboard-aggregate';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';

interface OutletBreakdown {
  outletId: string;
  outletName: string;
  trxCount: number;
  revenue: number;
}

interface POSum {
  status: string;
  count: number;
  total: number;
}

interface Props {
  canViewNominal: boolean;
  fromKey: string;
  toKey: string;
  outletFilter: string;
  outlets: Array<{ pawoon_id: string; name: string }>;
  totalRevenue: number;
  totalTrx: number;
  dailySeries: DayPoint[];
  sessionSeries: SessionPoint[];
  topMenu: TopMenuPoint[];
  outletBreakdown: OutletBreakdown[];
  poSummary: POSum[];
  poCount: number;
}

const PRESETS = [
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
  { label: '90 hari', days: 90 },
];

function formatNominal(value: number, canView: boolean): string {
  return canView ? formatCurrency(value) : '••••••';
}

export function ReportsView({
  canViewNominal,
  fromKey,
  toKey,
  outletFilter,
  outlets,
  totalRevenue,
  totalTrx,
  dailySeries,
  sessionSeries,
  topMenu,
  outletBreakdown,
  poSummary,
  poCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(fromKey);
  const [to, setTo] = useState(toKey);
  const [outlet, setOutlet] = useState(outletFilter);
  const [isPending, startTransition] = useTransition();

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (outlet) params.set('outlet', outlet);
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  function applyPreset(days: number) {
    const today = new Date();
    const past = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(d);
    const newFrom = fmt(past);
    const newTo = fmt(today);
    setFrom(newFrom);
    setTo(newTo);
    const params = new URLSearchParams();
    params.set('from', newFrom);
    params.set('to', newTo);
    if (outlet) params.set('outlet', outlet);
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  function handlePrint() {
    window.print();
  }

  const avgDaily = dailySeries.length > 0 ? totalRevenue / dailySeries.length : 0;

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:flex-row print:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-midnight dark:text-cream">Reports</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Periode {formatDate(fromKey)} sd {formatDate(toKey)} · {totalTrx.toLocaleString('id-ID')}{' '}
            transaksi
            {outletFilter ? ` · outlet filtered` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          Print / Save PDF
        </Button>
      </header>

      <div className="rounded-xl bg-surface p-5 shadow-card print:hidden">
        <form onSubmit={applyFilter} className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-forest">Dari</label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                strokeWidth={1.5}
              />
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="pl-9 lg:w-44"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-forest">Sampai</label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                strokeWidth={1.5}
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="pl-9 lg:w-44"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-forest">Outlet</label>
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-56"
            >
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.pawoon_id} value={o.pawoon_id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Terapkan
            </Button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Preset:</span>
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyPreset(p.days)}
              disabled={isPending}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Revenue" value={formatNominal(totalRevenue, canViewNominal)} />
        <SummaryCard label="Total Transaksi" value={formatNumber(totalTrx)} />
        <SummaryCard
          label="Rata-rata / Hari"
          value={formatNominal(Math.round(avgDaily), canViewNominal)}
          hint={`${dailySeries.length} hari ada transaksi`}
        />
        <SummaryCard
          label="Avg Transaksi / Order"
          value={
            totalTrx > 0
              ? formatNominal(Math.round(totalRevenue / totalTrx), canViewNominal)
              : '—'
          }
        />
      </div>

      {/* Outlet breakdown */}
      <Section title="Breakdown per Outlet">
        {outletBreakdown.length === 0 ? (
          <EmptyHint />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-right">Transaksi</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">% Share</th>
              </tr>
            </thead>
            <tbody>
              {outletBreakdown.map((o) => {
                const pct = totalRevenue > 0 ? (o.revenue / totalRevenue) * 100 : 0;
                return (
                  <tr
                    key={o.outletId}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3 text-text-primary">{o.outletName}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(o.trxCount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatNominal(o.revenue, canViewNominal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Session breakdown */}
      <Section title="Breakdown per Session (waktu makan WIB)">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 text-left">Session</th>
              <th className="px-4 py-3 text-right">Transaksi</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Avg / Trx</th>
            </tr>
          </thead>
          <tbody>
            {sessionSeries.map((s) => {
              const avg = s.trxCount > 0 ? s.revenue / s.trxCount : 0;
              return (
                <tr
                  key={s.session}
                  className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                >
                  <td className="px-4 py-3 text-text-primary">{s.label}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(s.trxCount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatNominal(s.revenue, canViewNominal)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-muted">
                    {formatNominal(Math.round(avg), canViewNominal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Top menu */}
      <Section title="Top 10 Menu (by qty terjual)">
        {topMenu.length === 0 ? (
          <EmptyHint message="Items detail belum ter-sync dari Pawoon" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topMenu.map((m, idx) => (
                <tr
                  key={m.productId}
                  className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                >
                  <td className="px-4 py-3 font-mono text-text-muted">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-text-primary">{m.productName}</div>
                    <div className="font-mono text-[11px] text-text-muted">{m.productId}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(m.qty)} pcs</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatNominal(m.revenue, canViewNominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* PO summary */}
      <Section
        title={`Aktivitas PO di Periode (${poCount} PO)`}
      >
        {poSummary.length === 0 ? (
          <EmptyHint message="Tidak ada PO di periode ini" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {poSummary.map((s) => (
              <div key={s.status} className="rounded-lg bg-mint/30 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(s.status)}>{s.status}</Badge>
                </div>
                <p className="mt-2 font-mono text-lg font-bold text-midnight dark:text-cream">
                  {formatNumber(s.count)}
                </p>
                <p className="text-[11px] text-text-muted">
                  {formatNominal(s.total, canViewNominal)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {!canViewNominal ? (
        <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning print:hidden">
          ℹ Nominal disembunyikan untuk role kamu (`reports.full` cuma admin/manager/spv).
          Hubungi atasan untuk akses penuh.
        </p>
      ) : null}

      <p className="text-center text-xs text-text-muted print:block">
        Dibuat dengan OMNI-STOCK V2.0 · {formatDate(new Date())}
      </p>
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'draft':
      return 'poDraft';
    case 'submitted':
      return 'poSubmitted';
    case 'approved':
      return 'poApproved';
    case 'ordered':
      return 'poOrdered';
    case 'partial_received':
      return 'syncStale';
    case 'received':
      return 'poReceived';
    case 'cancelled':
      return 'poCancelled';
    default:
      return 'poDraft';
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card print:break-inside-avoid">
      <div className="border-b border-border-default px-5 py-3">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="overflow-x-auto p-5 sm:p-0">{children}</div>
    </div>
  );
}

function EmptyHint({ message = 'Belum ada data' }: { message?: string }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-text-muted">{message}</div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 font-mono text-xl font-bold text-midnight dark:text-cream">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { triggerStockCardSync } from '@/lib/actions/pawoon.actions';
import { formatNumber, formatDateTime, formatDate } from '@/lib/utils/format';

export interface StockCardRow {
  pawoon_outlet_id: string;
  pawoon_product_id: string;
  product_name: string | null;
  period_date: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  penjualan: number;
  transfer: number;
  penyesuaian: number;
  stok_akhir: number;
  synced_at: string | null;
}

interface Props {
  initial: StockCardRow[];
  total: number;
  periodDate: string;
  outletFilter: string;
  lastSyncedAt: string | null;
  lastSyncedCount: number | null;
  fetchError: string | null;
}

export function StockCardView({
  initial,
  total,
  periodDate,
  outletFilter,
  lastSyncedAt,
  lastSyncedCount,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [outlet, setOutlet] = useState(outletFilter);
  const [date, setDate] = useState(periodDate);
  const [isFilterPending, startFilter] = useTransition();
  const [isSyncPending, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (date) params.set('date', date);
    else params.delete('date');
    if (outlet) params.set('outlet', outlet);
    else params.delete('outlet');
    startFilter(() => router.push(`/inventory/stock-card?${params.toString()}`));
  }

  function handleSync() {
    setSyncMessage(null);
    setSyncError(null);
    startSync(async () => {
      const result = await triggerStockCardSync();
      if ('error' in result && result.error) {
        setSyncError(result.error);
      } else if ('data' in result && result.data) {
        setSyncMessage(
          `Sync OK — ${result.data.records_synced ?? 0} row stok (${
            result.data.duration_ms ?? 0
          } ms)`,
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Kartu Stok</h1>
          <p className="text-sm text-text-secondary">
            Real-time dari Pawoon · {formatDate(periodDate)} · {total.toLocaleString('id-ID')} produk
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncedAt ? (
            <Badge variant="syncOk" title={`${lastSyncedCount ?? 0} row`}>
              ✓ {formatDateTime(lastSyncedAt)}
            </Badge>
          ) : (
            <Badge variant="syncStale">Belum pernah sync</Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={isSyncPending}
          >
            {isSyncPending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
            )}
            Refresh
          </Button>
        </div>
      </header>

      {syncMessage ? (
        <p className="rounded-lg bg-mint/40 px-3 py-2 text-sm text-teal">{syncMessage}</p>
      ) : null}
      {syncError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{syncError}</p>
      ) : null}
      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load kartu stok: {fetchError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={applyFilters}
          className="flex flex-col gap-3 border-b border-border-default bg-surface-alt px-5 py-3 sm:flex-row sm:items-center"
        >
          <div className="relative">
            <Calendar
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.5}
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-9 sm:w-44"
            />
          </div>
          <Input
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            placeholder="Filter outlet ID (opsional)"
            className="sm:w-60"
          />
          <Button type="submit" size="sm" disabled={isFilterPending}>
            {isFilterPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Terapkan
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-right">Stok Awal</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Keluar</th>
                <th className="px-4 py-3 text-right">Penjualan</th>
                <th className="px-4 py-3 text-right">Transfer</th>
                <th className="px-4 py-3 text-right">Penyesuaian</th>
                <th className="px-4 py-3 text-right">Stok Akhir</th>
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <EmptyState
                      hasFilter={Boolean(outletFilter)}
                      date={periodDate}
                      onSync={handleSync}
                      isSyncing={isSyncPending}
                    />
                  </td>
                </tr>
              ) : (
                initial.map((r) => (
                  <tr
                    key={`${r.pawoon_outlet_id}-${r.pawoon_product_id}`}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3">
                      <div className="text-text-primary">{r.product_name ?? '—'}</div>
                      <div className="font-mono text-[11px] text-text-muted">{r.pawoon_product_id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-text-muted">
                      {r.pawoon_outlet_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(r.stok_awal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-teal">+{formatNumber(r.masuk)}</td>
                    <td className="px-4 py-3 text-right font-mono text-danger">
                      −{formatNumber(r.keluar)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(r.penjualan)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(r.transfer)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(r.penyesuaian)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatNumber(r.stok_akhir)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  hasFilter,
  date,
  onSync,
  isSyncing,
}: {
  hasFilter: boolean;
  date: string;
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-base font-medium text-forest dark:text-cream">
        {hasFilter ? 'Tidak ada data untuk filter ini' : `Belum ada kartu stok untuk ${formatDate(date)}`}
      </p>
      <p className="max-w-md text-sm text-text-muted">
        {hasFilter
          ? 'Coba ubah filter outlet atau tanggal.'
          : 'Cron otomatis fetch setiap 30 menit. Atau trigger sync manual sekarang.'}
      </p>
      {!hasFilter ? (
        <Button onClick={onSync} disabled={isSyncing} variant="lime">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync sekarang
        </Button>
      ) : null}
    </div>
  );
}

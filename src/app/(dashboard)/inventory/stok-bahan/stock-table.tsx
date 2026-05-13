'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ClipboardCheck, Loader2, PackageOpen, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatNumber } from '@/lib/utils/format';
import type { ComputedStock } from '@/lib/utils/stock-compute';
import { BulkOpnameDialog } from './bulk-opname-dialog';
import { StockOpnameDialog } from './stock-opname-dialog';

export interface StockRow extends ComputedStock {
  name: string;
  kategori: string | null;
  satuan_dapur: string | null;
  min_stok: number | null;
  min_stok_unit: string | null;
}

interface Props {
  rows: StockRow[];
  counts: { total: number; critical: number; warning: number; no_baseline: number };
  outlets: Array<{ id: string; name: string }>;
  distinctKategori: string[];
  outletFilter: string;
  kategoriFilter: string;
  statusFilter: string;
  canManage: boolean;
}

const STATUS_LABEL: Record<StockRow['status'], string> = {
  safe: 'Safe',
  warning: 'Warning',
  critical: 'Critical',
  no_baseline: 'Belum Opname',
};

function statusVariant(status: StockRow['status']) {
  switch (status) {
    case 'safe':
      return 'stockSafe';
    case 'warning':
      return 'stockWarning';
    case 'critical':
      return 'stockCritical';
    case 'no_baseline':
      return 'poDraft';
  }
}

export function StockBahanTable({
  rows,
  counts,
  outlets,
  distinctKategori,
  outletFilter,
  kategoriFilter,
  statusFilter,
  canManage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [outlet, setOutlet] = useState(outletFilter);
  const [kategori, setKategori] = useState(kategoriFilter);
  const [status, setStatus] = useState(statusFilter);
  const [opnameTarget, setOpnameTarget] = useState<StockRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));
  const hasFilter = Boolean(outletFilter || kategoriFilter || statusFilter);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (outlet) params.set('outlet', outlet);
    else params.delete('outlet');
    if (kategori) params.set('kategori', kategori);
    else params.delete('kategori');
    if (status) params.set('status', status);
    else params.delete('status');
    startTransition(() => router.push(`/inventory/stok-bahan?${params.toString()}`));
  }

  function reset() {
    setOutlet('');
    setKategori('');
    setStatus('');
    startTransition(() => router.push('/inventory/stok-bahan'));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Stok Bahan Baku</h1>
          <p className="text-sm text-text-secondary">
            {counts.total} bahan · {counts.critical} critical · {counts.warning} warning ·{' '}
            {counts.no_baseline} belum opname
          </p>
        </div>
        {canManage ? (
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" strokeWidth={1.5} />
            Bulk Opname (XLS/CSV)
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Total Bahan"
          value={counts.total}
          icon={<PackageOpen className="h-5 w-5 text-teal" strokeWidth={1.5} />}
        />
        <SummaryCard label="Critical" value={counts.critical} accent="text-danger" />
        <SummaryCard label="Warning" value={counts.warning} accent="text-warning" />
        <SummaryCard label="Belum Opname" value={counts.no_baseline} accent="text-text-muted" />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={applyFilters}
          className="flex flex-col gap-3 border-b border-border-default bg-surface-alt px-5 py-3 sm:flex-row sm:items-center"
        >
          <select
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary sm:w-44"
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary sm:w-48"
          >
            <option value="">Semua kategori</option>
            {distinctKategori.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary sm:w-44"
          >
            <option value="">Semua status</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="safe">Safe</option>
            <option value="no_baseline">Belum Opname</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Terapkan
            </Button>
            {hasFilter ? (
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                Reset
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Bahan</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Last Opname</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Konsumsi</th>
                <th className="px-4 py-3 text-right">Adj</th>
                <th className="px-4 py-3 text-right">Stok Now</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-left">Status</th>
                {canManage ? <th className="px-4 py-3 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 10 : 9} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {hasFilter ? 'Tidak ada bahan cocok' : 'Belum ada bahan'}
                    </p>
                    {hasFilter ? (
                      <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                        Reset filter
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const unit = r.satuan_dapur ?? '';
                  return (
                    <tr
                      key={`${r.bahan_id}-${r.outlet_id ?? 'all'}`}
                      className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                    >
                      <td className="px-4 py-3">
                        <div className="text-text-primary">{r.name}</div>
                        {r.kategori ? (
                          <div className="text-[11px] text-text-muted">{r.kategori}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {r.outlet_id ? (outletNameById.get(r.outlet_id) ?? r.outlet_id) : '— semua —'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {r.baseline_date ? (
                          <div>
                            <div className="font-mono">{formatNumber(r.baseline_qty ?? 0)} {unit}</div>
                            <div className="text-[10px] text-text-muted">{formatDate(r.baseline_date)}</div>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-teal">
                        +{formatNumber(r.received_since)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-danger">
                        −{formatNumber(r.consumed_since)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-muted">
                        {r.adjustments_since !== 0
                          ? `${r.adjustments_since > 0 ? '+' : ''}${formatNumber(r.adjustments_since)}`
                          : '0'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {r.current_stock != null ? (
                          <span
                            className={
                              r.status === 'critical'
                                ? 'text-danger'
                                : r.status === 'warning'
                                  ? 'text-warning'
                                  : 'text-text-primary'
                            }
                          >
                            {formatNumber(r.current_stock)} {unit}
                          </span>
                        ) : (
                          <span className="text-text-muted">?</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">
                        {r.min_stok != null
                          ? `${formatNumber(r.min_stok)} ${r.min_stok_unit ?? ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpnameTarget(r)}
                            title="Stok Opname"
                          >
                            <ClipboardCheck className="h-3 w-3 text-teal" strokeWidth={1.5} />
                            Opname
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage ? (
        <BulkOpnameDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onSuccess={() => {
            setBulkOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {canManage && opnameTarget ? (
        <StockOpnameDialog
          key={`${opnameTarget.bahan_id}-${opnameTarget.outlet_id ?? 'all'}`}
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpnameTarget(null);
          }}
          bahanId={opnameTarget.bahan_id}
          bahanName={opnameTarget.name}
          outletId={opnameTarget.outlet_id}
          satuanDapur={opnameTarget.satuan_dapur}
          currentComputed={opnameTarget.current_stock}
          onSuccess={() => {
            setOpnameTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent = 'text-text-primary',
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 font-mono text-2xl font-bold ${accent}`}>{value.toLocaleString('id-ID')}</p>
    </div>
  );
}

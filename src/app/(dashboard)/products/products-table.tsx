'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { triggerProductSync } from '@/lib/actions/pawoon.actions';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface ProductRow {
  pawoon_id: string;
  name: string;
  category_name: string | null;
  price: number | null;
  sku: string | null;
  is_sold: boolean;
  outlet_ids: string[] | null;
  synced_at: string | null;
}

interface Props {
  initial: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  outletFilter: string;
  lastSyncedAt: string | null;
  lastSyncedCount: number | null;
  fetchError: string | null;
}

function staleness(lastSyncedAt: string | null): 'ok' | 'stale' | 'never' {
  if (!lastSyncedAt) return 'never';
  const age = Date.now() - new Date(lastSyncedAt).getTime();
  return age < 30 * 60 * 1000 ? 'ok' : 'stale';
}

export function ProductsTable({
  initial,
  total,
  page,
  pageSize,
  query,
  outletFilter,
  lastSyncedAt,
  lastSyncedCount,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [outlet, setOutlet] = useState(outletFilter);
  const [isSearchPending, startSearch] = useTransition();
  const [isSyncPending, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const syncState = staleness(lastSyncedAt);

  function updateUrl(next: { q?: string; outlet?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.outlet !== undefined) {
      if (next.outlet) params.set('outlet', next.outlet);
      else params.delete('outlet');
    }
    if (next.page !== undefined) params.set('page', String(next.page));
    startSearch(() => router.push(`/products?${params.toString()}`));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl({ q: search, outlet, page: 1 });
  }

  function handleSync() {
    setSyncMessage(null);
    setSyncError(null);
    startSync(async () => {
      const result = await triggerProductSync();
      if ('error' in result && result.error) {
        setSyncError(result.error);
      } else if ('data' in result && result.data) {
        setSyncMessage(
          `Sync OK — ${result.data.records_synced ?? 0} produk (${
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
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Products</h1>
          <p className="text-sm text-text-secondary">
            Sumber: Pawoon Open API · {total.toLocaleString('id-ID')} produk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge state={syncState} lastSyncedAt={lastSyncedAt} lastSyncedCount={lastSyncedCount} />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={isSyncPending}
            aria-label="Refresh dari Pawoon"
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
          Gagal load produk: {fetchError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 border-b border-border-default bg-surface-alt px-5 py-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.5}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="pl-9"
            />
          </div>
          <Input
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            placeholder="Filter outlet ID (opsional)"
            className="sm:w-56"
          />
          <Button type="submit" size="sm" disabled={isSearchPending}>
            {isSearchPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cari
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">ID Pawoon</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <EmptyState
                      lastSyncedAt={lastSyncedAt}
                      onSync={handleSync}
                      isSyncing={isSyncPending}
                    />
                  </td>
                </tr>
              ) : (
                initial.map((p) => (
                  <tr
                    key={p.pawoon_id}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3 font-mono text-[13px] text-teal">{p.pawoon_id}</td>
                    <td className="px-4 py-3 text-text-primary">{p.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{p.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {p.price != null ? formatCurrency(p.price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{p.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {p.outlet_ids?.length ? `${p.outlet_ids.length} outlet` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.is_sold ? (
                        <Badge variant="stockSafe">Aktif</Badge>
                      ) : (
                        <Badge variant="poDraft">Nonaktif</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {initial.length > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            disabled={isSearchPending}
            onChange={(p) => updateUrl({ page: p })}
          />
        ) : null}
      </div>
    </div>
  );
}

function SyncBadge({
  state,
  lastSyncedAt,
  lastSyncedCount,
}: {
  state: 'ok' | 'stale' | 'never';
  lastSyncedAt: string | null;
  lastSyncedCount: number | null;
}) {
  if (state === 'never') return <Badge variant="syncStale">Belum pernah sync</Badge>;
  const label =
    state === 'ok' ? `✓ ${formatDateTime(lastSyncedAt!)}` : `⚠ ${formatDateTime(lastSyncedAt!)}`;
  return (
    <span
      className={cn('inline-flex flex-col items-end gap-0.5 text-[11px]')}
      title={`Last sync: ${lastSyncedCount ?? 0} produk`}
    >
      <Badge variant={state === 'ok' ? 'syncOk' : 'syncStale'}>{label}</Badge>
    </span>
  );
}

function EmptyState({
  lastSyncedAt,
  onSync,
  isSyncing,
}: {
  lastSyncedAt: string | null;
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-base font-medium text-forest dark:text-cream">
        {lastSyncedAt
          ? 'Tidak ada produk cocok dengan filter ini'
          : 'Belum ada data produk dari Pawoon'}
      </p>
      <p className="max-w-md text-sm text-text-muted">
        {lastSyncedAt
          ? 'Coba reset filter atau ubah kata kunci pencarian.'
          : 'Jalankan sync manual untuk fetch produk dari Pawoon Open API. Cron otomatis jalan setiap 15 menit.'}
      </p>
      {!lastSyncedAt ? (
        <Button onClick={onSync} disabled={isSyncing} variant="lime">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync sekarang
        </Button>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border-default px-5 py-3 text-sm">
      <span className="text-text-muted">
        Hal. {page} dari {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Selanjutnya
        </Button>
      </div>
    </div>
  );
}

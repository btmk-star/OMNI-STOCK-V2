'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import {
  getRawMenuItems,
  toggleRawMenuActive,
} from '@/lib/actions/raw-menu.actions';
import {
  RawMenuFormDialog,
  type BahanOption,
  type RawMenuFormInitial,
} from './raw-menu-form-dialog';

export interface RawMenuRow {
  id: string;
  name: string;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  total_cogs: number | null;
  cogs_per_unit: number | null;
  is_active: boolean;
  updated_at: string | null;
}

interface Props {
  initial: RawMenuRow[];
  total: number;
  query: string;
  showInactive: boolean;
  bahanOptions: BahanOption[];
  canManage: boolean;
  fetchError: string | null;
}

export function RawMenuTable({
  initial,
  total,
  query,
  showInactive,
  bahanOptions,
  canManage,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [includeInactive, setIncludeInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RawMenuFormInitial | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (includeInactive) params.set('show', 'all');
    startTransition(() => router.push(`/inventory/raw-menu?${params.toString()}`));
  }

  function reset() {
    setSearch('');
    setIncludeInactive(false);
    startTransition(() => router.push('/inventory/raw-menu'));
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function openEdit(row: RawMenuRow) {
    setActionError(null);
    setLoadingEditId(row.id);
    try {
      const res = await getRawMenuItems(row.id);
      if ('error' in res && res.error) {
        setActionError(`Load items gagal: ${res.error}`);
        return;
      }
      setEditing({
        id: row.id,
        name: row.name,
        satuan_hasil: row.satuan_hasil,
        jumlah_hasil: row.jumlah_hasil,
        items: res.data ?? [],
      });
      setDialogOpen(true);
    } finally {
      setLoadingEditId(null);
    }
  }

  function toggleActive(row: RawMenuRow) {
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleRawMenuActive(row.id, !row.is_active);
      if ('error' in res && res.error) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Raw Menu</h1>
          <p className="text-sm text-text-secondary">
            {total} semi-finished goods · komposisi bahan dengan COGS
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tambah Raw Menu
          </Button>
        ) : null}
      </header>

      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {fetchError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={handleSearch}
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
              placeholder="Cari nama SFG..."
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-teal focus-visible:ring-teal/30"
            />
            Inactive
          </label>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cari
          </Button>
          {(query || showInactive) ? (
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          ) : null}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Nama SFG</th>
                <th className="px-4 py-3 text-left">Satuan Hasil</th>
                <th className="px-4 py-3 text-right">Jumlah Hasil</th>
                <th className="px-4 py-3 text-right">Total COGS</th>
                <th className="px-4 py-3 text-right">COGS/Unit</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {query ? 'Tidak ada hasil pencarian' : 'Belum ada SFG'}
                    </p>
                    {canManage && !query ? (
                      <Button size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Tambah SFG Pertama
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                initial.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border-default/50 text-sm hover:bg-mint/30 ${
                      !r.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">{r.id}</td>
                    <td className="px-4 py-3 text-text-primary">{r.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.satuan_hasil ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.jumlah_hasil != null ? formatNumber(r.jumlah_hasil) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.total_cogs != null ? formatCurrency(r.total_cogs) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {r.cogs_per_unit != null ? formatCurrency(r.cogs_per_unit) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_active ? (
                        <Badge variant="syncOk">Active</Badge>
                      ) : (
                        <Badge variant="poDraft">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canManage ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={loadingEditId === r.id || actionPending}
                              onClick={() => openEdit(r)}
                              title="Edit"
                            >
                              {loadingEditId === r.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                              ) : (
                                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={actionPending}
                              onClick={() => toggleActive(r)}
                              title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {r.is_active ? (
                                <PowerOff className="h-3 w-3 text-danger" strokeWidth={1.5} />
                              ) : (
                                <Power className="h-3 w-3 text-success" strokeWidth={1.5} />
                              )}
                            </Button>
                          </>
                        ) : null}
                        <Link
                          href={`/inventory/raw-menu/${encodeURIComponent(r.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                        >
                          Detail
                          <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage ? (
        <RawMenuFormDialog
          key={editing?.id ?? 'create'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editing}
          bahanOptions={bahanOptions}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

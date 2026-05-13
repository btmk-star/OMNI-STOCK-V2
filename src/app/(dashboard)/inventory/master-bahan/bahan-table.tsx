'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { toggleBahanActive } from '@/lib/actions/bahan.actions';
import { BahanFormDialog } from './bahan-form-dialog';

export interface BahanRow {
  id: string;
  name: string;
  tipe: 'packaged' | 'raw_bulk';
  kategori: string | null;
  kemasan_beli: string | null;
  satuan_dapur: string | null;
  min_stok: number | null;
  min_stok_unit: string | null;
  harga_beli: number | null;
  isi_yield: number | null;
  harga_per_porsi: number | null;
  outlet_id: string | null;
  supplier_id: string | null;
  is_active: boolean;
  os_suppliers: { name: string } | null;
}

interface Props {
  initial: BahanRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  outletFilter: string;
  kategoriFilter: string;
  tipeFilter: string;
  showInactive: boolean;
  distinctKategori: string[];
  distinctOutlet: string[];
  suppliers: Array<{ id: string; name: string }>;
  canManage: boolean;
  fetchError: string | null;
}

export function BahanTable({
  initial,
  total,
  page,
  pageSize,
  query,
  outletFilter,
  kategoriFilter,
  tipeFilter,
  showInactive,
  distinctKategori,
  distinctOutlet,
  suppliers,
  canManage,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [outlet, setOutlet] = useState(outletFilter);
  const [kategori, setKategori] = useState(kategoriFilter);
  const [tipe, setTipe] = useState(tipeFilter);
  const [includeInactive, setIncludeInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BahanRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function updateUrl(next: {
    q?: string;
    outlet?: string;
    kategori?: string;
    tipe?: string;
    page?: number;
    show?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      if (v === '' || v === 0) params.delete(k);
      else params.set(k, String(v));
    }
    if (next.page === undefined) params.set('page', '1');
    startTransition(() => router.push(`/inventory/master-bahan?${params.toString()}`));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl({
      q: search,
      outlet,
      kategori,
      tipe,
      page: 1,
      show: includeInactive ? 'all' : '',
    });
  }

  function resetFilters() {
    setSearch('');
    setOutlet('');
    setKategori('');
    setTipe('');
    setIncludeInactive(false);
    startTransition(() => router.push('/inventory/master-bahan'));
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: BahanRow) {
    setEditing(row);
    setDialogOpen(true);
  }
  function toggleActive(row: BahanRow) {
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleBahanActive(row.id, !row.is_active);
      if ('error' in res && res.error) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const hasFilter = Boolean(query || outletFilter || kategoriFilter || tipeFilter || showInactive);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Master Bahan</h1>
          <p className="text-sm text-text-secondary">
            {total.toLocaleString('id-ID')} bahan baku · packaged + raw bulk
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tambah Bahan
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
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 border-b border-border-default bg-surface-alt px-5 py-3 lg:flex-row lg:items-center"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.5}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama bahan..."
              className="pl-9"
            />
          </div>
          <select
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-44"
          >
            <option value="">Semua outlet</option>
            {distinctOutlet.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-48"
          >
            <option value="">Semua kategori</option>
            {distinctKategori.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={tipe}
            onChange={(e) => setTipe(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-36"
          >
            <option value="">Semua tipe</option>
            <option value="packaged">Packaged</option>
            <option value="raw_bulk">Raw Bulk</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-teal focus-visible:ring-teal/30"
            />
            Inactive
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Terapkan
            </Button>
            {hasFilter ? (
              <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Nama Bahan</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Kemasan</th>
                <th className="px-4 py-3 text-right">Min Stok</th>
                <th className="px-4 py-3 text-right">Harga Beli</th>
                <th className="px-4 py-3 text-right">Harga/Porsi</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                {canManage ? <th className="px-4 py-3 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {hasFilter
                        ? 'Tidak ada bahan dengan kombinasi filter ini'
                        : 'Belum ada data bahan'}
                    </p>
                    {hasFilter ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={resetFilters}
                      >
                        Reset filter
                      </Button>
                    ) : canManage ? (
                      <Button size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Tambah Bahan Pertama
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                initial.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b border-border-default/50 text-sm hover:bg-mint/30 ${
                      !b.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">{b.id}</td>
                    <td className="px-4 py-3 text-text-primary">{b.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.tipe === 'packaged' ? 'typePackaged' : 'typeRawBulk'}>
                        {b.tipe === 'packaged' ? 'Packaged' : 'Raw Bulk'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{b.kategori ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-muted">
                      {b.outlet_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.kemasan_beli ?? '—'}
                      {b.isi_yield ? ` (${formatNumber(b.isi_yield)} ${b.satuan_dapur ?? ''})` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {b.min_stok != null
                        ? `${formatNumber(b.min_stok)} ${b.min_stok_unit ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {b.harga_beli != null ? formatCurrency(b.harga_beli) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {b.harga_per_porsi != null ? formatCurrency(b.harga_per_porsi) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.os_suppliers?.name ?? '—'}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => openEdit(b)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.5} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => toggleActive(b)}
                            title={b.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {b.is_active ? (
                              <PowerOff className="h-3 w-3 text-danger" strokeWidth={1.5} />
                            ) : (
                              <Power className="h-3 w-3 text-success" strokeWidth={1.5} />
                            )}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {initial.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border-default px-5 py-3 text-sm">
            <span className="text-text-muted">
              Hal. {page} dari {totalPages} · {total} bahan
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || page <= 1}
                onClick={() => updateUrl({ page: page - 1 })}
              >
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || page >= totalPages}
                onClick={() => updateUrl({ page: page + 1 })}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <BahanFormDialog
          key={editing?.id ?? 'create'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editing}
          suppliers={suppliers}
          outlets={distinctOutlet}
          kategoriOptions={distinctKategori}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils/format';
import { toggleMenuActive } from '@/lib/actions/menu.actions';
import { MenuFormDialog } from './menu-form-dialog';

export interface MenuRow {
  id: string;
  name: string;
  pawoon_product_id: string | null;
  channel: string | null;
  kategori: string | null;
  outlet_id: string | null;
  recipe_id: string | null;
  harga_jual: number | null;
  total_cogs: number | null;
  margin_pct: number | null;
  is_active: boolean;
  os_recipes: { name: string } | null;
}

interface Props {
  initial: MenuRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  outletFilter: string;
  kategoriFilter: string;
  channelFilter: string;
  pawoonFilter: string;
  showInactive: boolean;
  distinctOutlets: string[];
  distinctKategoris: string[];
  distinctChannels: string[];
  recipes: Array<{ id: string; name: string; total_cogs: number | null }>;
  canManage: boolean;
  fetchError: string | null;
}

function marginAccent(pct: number | null) {
  if (pct == null) return 'text-text-muted';
  if (pct >= 60) return 'text-success';
  if (pct >= 30) return 'text-warning';
  return 'text-danger';
}

function channelBadgeVariant(channel: string | null) {
  if (!channel) return 'poDraft';
  if (channel.toLowerCase().includes('dine')) return 'channelDineIn';
  if (channel.toLowerCase().includes('grab')) return 'channelGrabFood';
  return 'poOrdered';
}

export function MenuTable({
  initial,
  total,
  page,
  pageSize,
  query,
  outletFilter,
  kategoriFilter,
  channelFilter,
  pawoonFilter,
  showInactive,
  distinctOutlets,
  distinctKategoris,
  distinctChannels,
  recipes,
  canManage,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [outlet, setOutlet] = useState(outletFilter);
  const [kategori, setKategori] = useState(kategoriFilter);
  const [channel, setChannel] = useState(channelFilter);
  const [pawoon, setPawoon] = useState(pawoonFilter);
  const [includeInactive, setIncludeInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = Boolean(query || outletFilter || kategoriFilter || channelFilter || pawoonFilter || showInactive);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (outlet) params.set('outlet', outlet);
    if (kategori) params.set('kategori', kategori);
    if (channel) params.set('channel', channel);
    if (pawoon) params.set('pawoon', pawoon);
    if (includeInactive) params.set('show', 'all');
    params.set('page', '1');
    startTransition(() => router.push(`/inventory/master-menu?${params.toString()}`));
  }

  function reset() {
    setSearch('');
    setOutlet('');
    setKategori('');
    setChannel('');
    setPawoon('');
    setIncludeInactive(false);
    startTransition(() => router.push('/inventory/master-menu'));
  }

  function changePage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    startTransition(() => router.push(`/inventory/master-menu?${params.toString()}`));
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: MenuRow) {
    setEditing(row);
    setDialogOpen(true);
  }
  function toggleActive(row: MenuRow) {
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleMenuActive(row.id, !row.is_active);
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
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Master Menu</h1>
          <p className="text-sm text-text-secondary">
            {total.toLocaleString('id-ID')} menu · linked ke Pawoon products + recipe per menu
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tambah Menu
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
          onSubmit={applyFilters}
          className="flex flex-col gap-3 border-b border-border-default bg-surface-alt px-5 py-3 lg:flex-row lg:flex-wrap lg:items-center"
        >
          <div className="relative flex-1 lg:min-w-[200px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.5}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama menu..."
              className="pl-9"
            />
          </div>
          <select
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-44"
          >
            <option value="">Semua outlet</option>
            {distinctOutlets.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-40"
          >
            <option value="">Semua kategori</option>
            {distinctKategoris.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-40"
          >
            <option value="">Semua channel</option>
            {distinctChannels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={pawoon}
            onChange={(e) => setPawoon(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-40"
          >
            <option value="">Pawoon: semua</option>
            <option value="mapped">✓ Ter-link</option>
            <option value="unmapped">⚠ Manual</option>
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
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Nama Menu</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Resep</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-left">Pawoon</th>
                {canManage ? <th className="px-4 py-3 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {hasFilter ? 'Tidak ada menu cocok' : 'Belum ada menu'}
                    </p>
                    {hasFilter ? (
                      <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                        Reset filter
                      </Button>
                    ) : canManage ? (
                      <Button size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Tambah Menu Pertama
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                initial.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-border-default/50 text-sm hover:bg-mint/30 ${
                      !m.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">{m.id}</td>
                    <td className="px-4 py-3 text-text-primary">{m.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.kategori ?? '—'}</td>
                    <td className="px-4 py-3">
                      {m.channel ? (
                        <Badge variant={channelBadgeVariant(m.channel)}>{m.channel}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-muted">
                      {m.outlet_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{m.os_recipes?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {m.harga_jual != null ? formatCurrency(m.harga_jual) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {m.total_cogs != null ? formatCurrency(m.total_cogs) : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${marginAccent(
                        m.margin_pct,
                      )}`}
                    >
                      {m.margin_pct != null ? `${m.margin_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {m.pawoon_product_id ? (
                        <Badge variant="syncOk">✓ Pawoon</Badge>
                      ) : (
                        <Badge variant="syncStale">Manual</Badge>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => openEdit(m)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.5} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => toggleActive(m)}
                            title={m.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {m.is_active ? (
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
              Hal. {page} dari {totalPages} · {total} menu
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <MenuFormDialog
          key={editing?.id ?? 'create'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editing}
          recipes={recipes}
          outlets={distinctOutlets}
          kategoriOptions={distinctKategoris}
          channelOptions={distinctChannels}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

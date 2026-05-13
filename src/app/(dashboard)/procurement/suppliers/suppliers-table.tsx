'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Loader2,
  Search,
  MessageCircle,
  Star,
  Plus,
  Pencil,
  Power,
  PowerOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  deactivateSupplier,
  reactivateSupplier,
} from '@/lib/actions/suppliers.actions';
import { SupplierFormDialog } from './supplier-form-dialog';

export interface SupplierRow {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  type: 'kerjasama' | 'non_kerjasama' | 'online_shop';
  payment_terms: string | null;
  lead_time_days: number | null;
  rating: number | null;
  is_active: boolean;
  notes: string | null;
}

interface Props {
  initial: SupplierRow[];
  total: number;
  query: string;
  typeFilter: string;
  showInactive: boolean;
  fetchError: string | null;
  canManage: boolean;
}

const TYPE_LABEL: Record<SupplierRow['type'], string> = {
  kerjasama: 'Kerjasama',
  non_kerjasama: 'Non-kerjasama',
  online_shop: 'Online Shop',
};

function typeBadgeVariant(type: SupplierRow['type']) {
  if (type === 'kerjasama') return 'poApproved';
  if (type === 'online_shop') return 'channelGrabFood';
  return 'poDraft';
}

function waLink(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function SuppliersTable({
  initial,
  total,
  query,
  typeFilter,
  showInactive,
  fetchError,
  canManage,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [type, setType] = useState(typeFilter);
  const [includeInactive, setIncludeInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasFilter = Boolean(query || typeFilter || showInactive);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (type) params.set('type', type);
    if (includeInactive) params.set('show', 'all');
    startTransition(() => router.push(`/procurement/suppliers?${params.toString()}`));
  }

  function reset() {
    setSearch('');
    setType('');
    setIncludeInactive(false);
    startTransition(() => router.push('/procurement/suppliers'));
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: SupplierRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  function toggleActive(row: SupplierRow) {
    setActionError(null);
    startActionTransition(async () => {
      const res = row.is_active
        ? await deactivateSupplier(row.id)
        : await reactivateSupplier(row.id);
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
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Suppliers</h1>
          <p className="text-sm text-text-secondary">
            {total.toLocaleString('id-ID')} vendor · kerjasama, non-kerjasama, online shop
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tambah Supplier
          </Button>
        ) : null}
      </header>

      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {fetchError}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={applyFilters}
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
              placeholder="Cari nama supplier..."
              className="pl-9"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary sm:w-44"
          >
            <option value="">Semua tipe</option>
            <option value="kerjasama">Kerjasama</option>
            <option value="non_kerjasama">Non-kerjasama</option>
            <option value="online_shop">Online Shop</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-teal focus-visible:ring-teal/30"
            />
            Tampilkan inactive
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
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Kontak</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">Lead Time</th>
                <th className="px-4 py-3 text-left">Rating</th>
                <th className="px-4 py-3 text-left">Status</th>
                {canManage ? <th className="px-4 py-3 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {hasFilter ? 'Tidak ada supplier cocok' : 'Belum ada supplier'}
                    </p>
                    {hasFilter ? (
                      <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                        Reset filter
                      </Button>
                    ) : canManage ? (
                      <Button size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Tambah Supplier Pertama
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                initial.map((s) => {
                  const wa = waLink(s.whatsapp);
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border-default/50 text-sm hover:bg-mint/30 ${
                        !s.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-teal">{s.id}</td>
                      <td className="px-4 py-3">
                        <div className="text-text-primary">{s.name}</div>
                        {s.contact_person ? (
                          <div className="text-[11px] text-text-muted">CP: {s.contact_person}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeBadgeVariant(s.type)}>{TYPE_LABEL[s.type]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-teal hover:underline"
                          >
                            <MessageCircle className="h-3 w-3" strokeWidth={1.5} />
                            <span className="font-mono text-[12px]">{s.whatsapp}</span>
                          </a>
                        ) : s.phone ? (
                          <span className="font-mono text-[12px] text-text-secondary">
                            {s.phone}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{s.payment_terms ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {s.lead_time_days != null ? `${s.lead_time_days} hari` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.rating != null ? (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Star className="h-3 w-3 text-warning" strokeWidth={1.5} />
                            {s.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.is_active ? (
                          <Badge variant="syncOk">Active</Badge>
                        ) : (
                          <Badge variant="poDraft">Inactive</Badge>
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
                              onClick={() => openEdit(s)}
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={1.5} />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={actionPending}
                              onClick={() => toggleActive(s)}
                              title={s.is_active ? 'Nonaktifkan' : 'Aktifkan kembali'}
                            >
                              {s.is_active ? (
                                <PowerOff className="h-3 w-3 text-danger" strokeWidth={1.5} />
                              ) : (
                                <Power className="h-3 w-3 text-success" strokeWidth={1.5} />
                              )}
                            </Button>
                          </div>
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
        <SupplierFormDialog
          key={editing?.id ?? 'create'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editing}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

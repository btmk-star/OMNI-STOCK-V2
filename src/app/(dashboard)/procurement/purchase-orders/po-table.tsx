'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronRight, Loader2, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import {
  POFormDialog,
  type BahanOption,
  type OutletOption,
  type SupplierOption,
} from './po-form-dialog';

export interface POHeader {
  id: string;
  supplier_id: string | null;
  outlet_ids: string[] | null;
  status:
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'ordered'
    | 'partial_received'
    | 'received'
    | 'wa_sent'
    | 'cancelled';
  total_amount: number | null;
  notes: string | null;
  created_by_name: string | null;
  ordered_at: string | null;
  expected_delivery: string | null;
  wa_sent_at: string | null;
  created_at: string | null;
  os_suppliers: { name: string } | null;
}

interface Props {
  initial: POHeader[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  statusFilter: string;
  supplierFilter: string;
  suppliers: SupplierOption[];
  bahanOptions: BahanOption[];
  outlets: OutletOption[];
  canCreate: boolean;
  fetchError: string | null;
}

const STATUS_LABEL: Record<POHeader['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  ordered: 'Ordered',
  partial_received: 'Partial',
  received: 'Received',
  wa_sent: 'WA Sent',
  cancelled: 'Cancelled',
};

function statusBadge(status: POHeader['status']) {
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
    case 'wa_sent':
      return 'poOrdered';
    case 'cancelled':
      return 'poCancelled';
    default:
      return 'poDraft';
  }
}

export function POTable({
  initial,
  total,
  page,
  pageSize,
  query,
  statusFilter,
  supplierFilter,
  suppliers,
  bahanOptions,
  outlets,
  canCreate,
  fetchError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [status, setStatus] = useState(statusFilter);
  const [supplier, setSupplier] = useState(supplierFilter);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = Boolean(query || statusFilter || supplierFilter);
  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (supplier) params.set('supplier', supplier);
    params.set('page', '1');
    startTransition(() => router.push(`/procurement/purchase-orders?${params.toString()}`));
  }

  function reset() {
    setSearch('');
    setStatus('');
    setSupplier('');
    startTransition(() => router.push('/procurement/purchase-orders'));
  }

  function changePage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    startTransition(() => router.push(`/procurement/purchase-orders?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Purchase Orders</h1>
          <p className="text-sm text-text-secondary">
            {total.toLocaleString('id-ID')} PO · termasuk migrasi V1.6 (ID prefix `MG-`)
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Buat PO
          </Button>
        ) : null}
      </header>

      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {fetchError}
        </p>
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
              placeholder="Cari ID PO..."
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-44"
          >
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="h-10 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary lg:w-56"
          >
            <option value="">Semua supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
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
                <th className="px-4 py-3 text-left">ID PO</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Dibuat</th>
                <th className="px-4 py-3 text-left">Tgl Order</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {hasFilter ? 'Tidak ada PO cocok' : 'Belum ada PO'}
                    </p>
                    {hasFilter ? (
                      <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                        Reset filter
                      </Button>
                    ) : canCreate ? (
                      <Button size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Buat PO Pertama
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                initial.map((po) => {
                  const firstOutletId = po.outlet_ids?.[0];
                  const firstOutletName = firstOutletId
                    ? (outletNameById.get(firstOutletId) ?? firstOutletId)
                    : null;
                  const outletExtra =
                    po.outlet_ids && po.outlet_ids.length > 1
                      ? ` +${po.outlet_ids.length - 1}`
                      : '';
                  return (
                    <tr
                      key={po.id}
                      className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-teal">{po.id}</td>
                      <td className="px-4 py-3 text-text-primary">
                        {po.os_suppliers?.name ?? po.supplier_id ?? '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-[13px] text-text-secondary"
                        title={po.outlet_ids?.join(', ') ?? ''}
                      >
                        {firstOutletName ? `${firstOutletName}${outletExtra}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadge(po.status)}>{STATUS_LABEL[po.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {po.total_amount != null ? formatCurrency(po.total_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {po.created_at ? formatDate(po.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {po.ordered_at ? formatDate(po.ordered_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/procurement/purchase-orders/${encodeURIComponent(po.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                        >
                          Detail
                          <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {initial.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border-default px-5 py-3 text-sm">
            <span className="text-text-muted">
              Hal. {page} dari {totalPages} · {total} PO
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

      {canCreate ? (
        <POFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          suppliers={suppliers}
          bahanOptions={bahanOptions}
          outlets={outlets}
          onSuccess={(id) =>
            router.push(`/procurement/purchase-orders/${encodeURIComponent(id)}`)
          }
        />
      ) : null}
    </div>
  );
}

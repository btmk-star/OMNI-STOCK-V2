import Link from 'next/link';
import { Truck, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

interface DeliveryRow {
  id: string;
  po_id: string | null;
  supplier_id: string | null;
  outlet_id: string | null;
  status:
    | 'pending'
    | 'in_transit'
    | 'arrived'
    | 'inspected'
    | 'accepted'
    | 'partial_accepted'
    | 'rejected';
  received_at: string | null;
  pushed_to_pawoon: boolean;
  notes: string | null;
  created_at: string | null;
  os_suppliers: { name: string } | null;
}

const STATUS_LABEL: Record<DeliveryRow['status'], string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  arrived: 'Arrived',
  inspected: 'Inspected',
  accepted: 'Accepted',
  partial_accepted: 'Partial Accepted',
  rejected: 'Rejected',
};

function statusBadge(status: DeliveryRow['status']) {
  switch (status) {
    case 'pending':
      return 'poDraft';
    case 'in_transit':
      return 'poOrdered';
    case 'arrived':
    case 'inspected':
      return 'poSubmitted';
    case 'accepted':
      return 'poReceived';
    case 'partial_accepted':
      return 'syncStale';
    case 'rejected':
      return 'poCancelled';
    default:
      return 'poDraft';
  }
}

export default async function DeliveryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_deliveries')
    .select('id,po_id,supplier_id,outlet_id,status,received_at,pushed_to_pawoon,notes,created_at,os_suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  const deliveries = (data ?? []) as unknown as DeliveryRow[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-teal" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Delivery</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Tracking pengiriman bahan dari supplier ke outlet · auto push ke Pawoon stock saat accepted
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {error.message}
        </p>
      ) : null}

      {deliveries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">ID Delivery</th>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Outlet</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Received</th>
                  <th className="px-4 py-3 text-left">Pawoon Push</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-border-default/50 text-sm hover:bg-mint/30">
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">{d.id}</td>
                    <td className="px-4 py-3">
                      {d.po_id ? (
                        <Link
                          href={`/procurement/purchase-orders/${encodeURIComponent(d.po_id)}`}
                          className="font-mono text-[12px] text-teal hover:underline"
                        >
                          {d.po_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{d.os_suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-muted">{d.outlet_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge(d.status)}>{STATUS_LABEL[d.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {d.received_at ? formatDate(d.received_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.pushed_to_pawoon ? (
                        <Badge variant="syncOk">✓ Synced</Badge>
                      ) : (
                        <Badge variant="poDraft">Pending</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-surface p-12 text-center shadow-card">
      <Truck className="mx-auto h-10 w-10 text-teal/40" strokeWidth={1.5} />
      <p className="mt-3 text-base font-medium text-forest dark:text-cream">
        Belum ada delivery tercatat
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        Delivery akan muncul saat PO sudah di-mark `ordered` dan supplier mulai mengirim. Form tracking di Phase 3d.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link href="/procurement/purchase-orders">
          Lihat Purchase Orders
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Link>
      </Button>
    </div>
  );
}

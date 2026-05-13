import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export interface RecentPORow {
  id: string;
  supplier_id: string | null;
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
  created_at: string | null;
  os_suppliers: { name: string } | null;
}

const STATUS_LABEL: Record<RecentPORow['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  ordered: 'Ordered',
  partial_received: 'Partial',
  received: 'Received',
  wa_sent: 'WA Sent',
  cancelled: 'Cancelled',
};

function statusBadge(status: RecentPORow['status']) {
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

export function RecentPOTable({ rows }: { rows: RecentPORow[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
        <h2 className="text-base font-semibold text-text-primary">Recent PO Activity</h2>
        <Link
          href="/procurement/purchase-orders"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          Lihat semua
          <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-text-muted">Belum ada PO</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">ID PO</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-b border-border-default/50 text-sm hover:bg-mint/30">
                  <td className="px-4 py-3 font-mono text-[12px] text-teal">{po.id}</td>
                  <td className="px-4 py-3 text-text-primary">
                    {po.os_suppliers?.name ?? po.supplier_id ?? '—'}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

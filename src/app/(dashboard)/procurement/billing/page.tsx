import Link from 'next/link';
import { HandCoins, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface BillingRow {
  id: string;
  po_id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number;
  payment_status: 'unpaid' | 'paid' | 'overdue' | 'partial';
  payment_method: string | null;
  paid_at: string | null;
  notes: string | null;
  os_suppliers: { name: string } | null;
}

const STATUS_LABEL: Record<BillingRow['payment_status'], string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  overdue: 'Overdue',
  paid: 'Paid',
};

function statusBadge(status: BillingRow['payment_status']) {
  switch (status) {
    case 'paid':
      return 'poReceived';
    case 'partial':
      return 'syncStale';
    case 'overdue':
      return 'poCancelled';
    case 'unpaid':
    default:
      return 'poDraft';
  }
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_billing')
    .select('id,po_id,supplier_id,invoice_number,invoice_date,amount,payment_status,payment_method,paid_at,notes,os_suppliers(name)')
    .order('invoice_date', { ascending: false })
    .limit(100);

  const billings = (data ?? []) as unknown as BillingRow[];
  const totalAmount = billings.reduce((sum, b) => sum + Number(b.amount), 0);
  const unpaidAmount = billings
    .filter((b) => b.payment_status !== 'paid')
    .reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-teal" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Billing</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Tagihan PO completed · status pembayaran PAID / UNPAID / OVERDUE
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {error.message}
        </p>
      ) : null}

      {billings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Total Tagihan" value={formatCurrency(totalAmount)} />
          <SummaryCard label="Belum Lunas" value={formatCurrency(unpaidAmount)} accent="warning" />
          <SummaryCard label="Sudah Lunas" value={formatCurrency(totalAmount - unpaidAmount)} accent="success" />
        </div>
      ) : null}

      {billings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Method</th>
                </tr>
              </thead>
              <tbody>
                {billings.map((b) => (
                  <tr key={b.id} className="border-b border-border-default/50 text-sm hover:bg-mint/30">
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">
                      {b.invoice_number ?? b.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/procurement/purchase-orders/${encodeURIComponent(b.po_id)}`}
                        className="font-mono text-[12px] text-teal hover:underline"
                      >
                        {b.po_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{b.os_suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.invoice_date ? formatDate(b.invoice_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatCurrency(b.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge(b.payment_status)}>
                        {STATUS_LABEL[b.payment_status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{b.payment_method ?? '—'}</td>
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

function SummaryCard({
  label,
  value,
  accent = 'muted',
}: {
  label: string;
  value: string;
  accent?: 'muted' | 'success' | 'warning' | 'danger';
}) {
  const accentClass =
    accent === 'success'
      ? 'text-success'
      : accent === 'warning'
      ? 'text-warning'
      : accent === 'danger'
      ? 'text-danger'
      : 'text-midnight dark:text-cream';
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-2 font-mono text-xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-surface p-12 text-center shadow-card">
      <HandCoins className="mx-auto h-10 w-10 text-teal/40" strokeWidth={1.5} />
      <p className="mt-3 text-base font-medium text-forest dark:text-cream">Belum ada tagihan</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        Tagihan akan muncul saat invoice supplier di-record (manual input setelah PO received). Form record invoice masuk Phase 3d.
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

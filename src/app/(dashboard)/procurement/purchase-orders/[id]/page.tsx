import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils/format';
import { POActionsBar } from '../po-actions-bar';
import type { BahanOption, SupplierOption } from '../po-form-dialog';

interface POHeaderRow {
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
  approved_at: string | null;
  ordered_at: string | null;
  expected_delivery: string | null;
  wa_sent_at: string | null;
  wa_sent_to: string | null;
  wa_send_method: string | null;
  created_at: string | null;
  updated_at: string | null;
  os_suppliers: {
    name: string;
    contact_person: string | null;
    whatsapp: string | null;
    phone: string | null;
  } | null;
}

interface POItemRow {
  id: string;
  bahan_id: string | null;
  qty: number;
  satuan: string | null;
  harga_satuan: number | null;
  subtotal: number | null;
  qty_received: number | null;
  os_bahan_baku: { name: string; satuan_dapur: string | null } | null;
}

interface POLogRow {
  id: string;
  action: string;
  actor_role: string | null;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<POHeaderRow['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  ordered: 'Ordered',
  partial_received: 'Partial Received',
  received: 'Received',
  wa_sent: 'WA Sent',
  cancelled: 'Cancelled',
};

function statusBadge(status: POHeaderRow['status']) {
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

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: po } = await supabase
    .from('os_purchase_orders')
    .select(
      'id,supplier_id,outlet_ids,status,total_amount,notes,created_by_name,approved_at,ordered_at,expected_delivery,wa_sent_at,wa_sent_to,wa_send_method,created_at,updated_at,os_suppliers(name,contact_person,whatsapp,phone)',
    )
    .eq('id', id)
    .single<POHeaderRow>();

  if (!po) notFound();

  const { data: userData } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (userData.user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single<{ role: Role }>();
    role = profile?.role ?? null;
  }
  const permissions = {
    create: hasPermission(role, 'po.create'),
    approve: hasPermission(role, 'po.approve'),
    sendWa: hasPermission(role, 'po.send_wa'),
    receive: hasPermission(role, 'delivery.receive'),
  };

  const [{ data: supplierList }, { data: bahanList }, { data: outletList }] = await Promise.all([
    supabase
      .from('os_suppliers')
      .select('id,name,whatsapp')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('os_bahan_baku')
      .select('id,name,satuan_dapur,harga_beli')
      .eq('is_active', true)
      .order('name')
      .limit(2000),
    supabase
      .from('pawoon_outlets')
      .select('pawoon_id,name')
      .eq('is_active', true)
      .order('name'),
  ]);
  const outletIds = (outletList ?? [])
    .map((o) => (o.pawoon_id as string) ?? (o.name as string))
    .filter(Boolean);

  const { data: items } = await supabase
    .from('os_po_items')
    .select('id,bahan_id,qty,satuan,harga_satuan,subtotal,qty_received,os_bahan_baku(name,satuan_dapur)')
    .eq('po_id', id)
    .order('created_at');

  const { data: logs } = await supabase
    .from('os_po_logs')
    .select('id,action,actor_role,old_status,new_status,notes,created_at')
    .eq('po_id', id)
    .order('created_at', { ascending: false });

  const itemRows = (items ?? []) as unknown as POItemRow[];
  const logRows = (logs ?? []) as unknown as POLogRow[];
  const totalReceived = itemRows.reduce(
    (sum, it) => sum + Number(it.qty_received ?? 0),
    0,
  );
  const totalOrdered = itemRows.reduce((sum, it) => sum + Number(it.qty ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/procurement/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-teal"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        Back ke Purchase Orders
      </Link>

      <header className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-teal">{po.id}</p>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">
            PO ke {po.os_suppliers?.name ?? po.supplier_id ?? '—'}
          </h1>
          <p className="text-sm text-text-secondary">
            {itemRows.length} item · Outlet: {po.outlet_ids?.join(', ') ?? '—'}
            {po.created_by_name ? ` · Dibuat oleh ${po.created_by_name}` : ''}
          </p>
        </div>
        <Badge variant={statusBadge(po.status)}>{STATUS_LABEL[po.status]}</Badge>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Total Amount" value={po.total_amount != null ? formatCurrency(po.total_amount) : '—'} />
        <InfoCard
          label="Item Diterima"
          value={`${formatNumber(totalReceived)} / ${formatNumber(totalOrdered)}`}
        />
        <InfoCard
          label="Tanggal Order"
          value={po.ordered_at ? formatDate(po.ordered_at) : po.created_at ? formatDate(po.created_at) : '—'}
        />
        <InfoCard
          label="Estimasi Kirim"
          value={po.expected_delivery ? formatDate(po.expected_delivery) : '—'}
        />
      </div>

      <POActionsBar
        po={{
          id: po.id,
          supplier_id: po.supplier_id ?? '',
          supplier_name: po.os_suppliers?.name ?? null,
          supplier_whatsapp: po.os_suppliers?.whatsapp ?? null,
          outlet_ids: po.outlet_ids ?? [],
          notes: po.notes,
          expected_delivery: po.expected_delivery,
          status: po.status,
          total_amount: po.total_amount,
        }}
        permissions={permissions}
        suppliers={(supplierList ?? []) as SupplierOption[]}
        bahanOptions={(bahanList ?? []) as BahanOption[]}
        outlets={outletIds}
      />

      {po.os_suppliers ? (
        <div className="rounded-xl bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Kontak Supplier
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailRow label="Nama" value={po.os_suppliers.name} />
            <DetailRow label="Contact Person" value={po.os_suppliers.contact_person ?? '—'} />
            <DetailRow label="WhatsApp / Phone" value={po.os_suppliers.whatsapp ?? po.os_suppliers.phone ?? '—'} mono />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className="border-b border-border-default px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Bahan</th>
                <th className="px-4 py-3 text-right">Qty Order</th>
                <th className="px-4 py-3 text-right">Qty Diterima</th>
                <th className="px-4 py-3 text-left">Satuan</th>
                <th className="px-4 py-3 text-right">Harga Satuan</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-text-muted">
                    Tidak ada item
                  </td>
                </tr>
              ) : (
                itemRows.map((it, idx) => (
                  <tr
                    key={it.id}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3 text-text-muted">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-text-primary">{it.os_bahan_baku?.name ?? '—'}</div>
                      <div className="font-mono text-[11px] text-text-muted">{it.bahan_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(it.qty)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(it.qty_received ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {it.satuan ?? it.os_bahan_baku?.satuan_dapur ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {it.harga_satuan != null ? formatCurrency(it.harga_satuan) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {it.subtotal != null ? formatCurrency(it.subtotal) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {itemRows.length > 0 ? (
              <tfoot>
                <tr className="bg-cream/30 text-sm">
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold text-text-secondary">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-teal">
                    {po.total_amount != null ? formatCurrency(po.total_amount) : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {po.notes ? (
        <div className="rounded-xl bg-surface p-5 shadow-card">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Catatan
          </h2>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{po.notes}</p>
        </div>
      ) : null}

      <div className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          PO Log
        </h2>
        {logRows.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada log untuk PO ini.</p>
        ) : (
          <ol className="relative border-l border-teal/20 pl-5">
            {logRows.map((log) => (
              <li key={log.id} className="mb-4 last:mb-0">
                <span className="absolute -left-[5px] h-3 w-3 rounded-full bg-teal" />
                <p className="text-xs text-text-muted">{formatDateTime(log.created_at)}</p>
                <p className="text-sm font-medium text-text-primary">
                  {log.action}
                  {log.old_status && log.new_status
                    ? ` · ${log.old_status} → ${log.new_status}`
                    : ''}
                </p>
                {log.actor_role ? (
                  <p className="text-xs text-text-secondary">by {log.actor_role}</p>
                ) : null}
                {log.notes ? (
                  <p className="text-xs text-text-secondary mt-1">{log.notes}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-midnight dark:text-cream">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

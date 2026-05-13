'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Package,
  Pencil,
  Send,
  ShoppingCart,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  approvePO,
  cancelPO,
  getPOItems,
  getPOItemsForReceive,
  markPOOrdered,
  rejectPO,
  receivePO,
  sendPOWhatsApp,
  submitPO,
} from '@/lib/actions/po.actions';
import { POFormDialog, type BahanOption, type POFormInitial, type SupplierOption } from './po-form-dialog';
import { POReceiveDialog, type ReceiveItem } from './po-receive-dialog';
import type { WaProvider } from '@/lib/wa/types';

export type POStatusValue =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'ordered'
  | 'partial_received'
  | 'received'
  | 'wa_sent'
  | 'cancelled';

interface POMeta {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  supplier_whatsapp: string | null;
  outlet_ids: string[];
  notes: string | null;
  expected_delivery: string | null;
  status: POStatusValue;
  total_amount: number | null;
}

interface Props {
  po: POMeta;
  permissions: {
    create: boolean;
    approve: boolean;
    sendWa: boolean;
    receive: boolean;
  };
  suppliers: SupplierOption[];
  bahanOptions: BahanOption[];
  outlets: string[];
  waProviders: WaProvider[];
}

function buildWaMessage(po: POMeta) {
  const lines: string[] = [];
  lines.push(`Halo ${po.supplier_name ?? 'Supplier'},`);
  lines.push('');
  lines.push(`Mohon disiapkan PO berikut:`);
  lines.push(`*${po.id}*`);
  if (po.expected_delivery) {
    lines.push(`Estimasi kirim: ${po.expected_delivery}`);
  }
  if (po.outlet_ids.length > 0) {
    lines.push(`Outlet: ${po.outlet_ids.join(', ')}`);
  }
  if (po.total_amount != null) {
    lines.push(
      `Total: Rp ${po.total_amount.toLocaleString('id-ID')}`,
    );
  }
  if (po.notes) {
    lines.push('');
    lines.push(`Catatan: ${po.notes}`);
  }
  lines.push('');
  lines.push('Terima kasih.');
  return lines.join('\n');
}

export function POActionsBar({
  po,
  permissions,
  suppliers,
  bahanOptions,
  outlets,
  waProviders,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waInfo, setWaInfo] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<POFormInitial | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

  function run(label: string, fn: () => Promise<{ data?: unknown; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setError(`${label}: ${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  async function openEdit() {
    setError(null);
    const res = await getPOItems(po.id);
    if ('error' in res && res.error) {
      setError(`Load items gagal: ${res.error}`);
      return;
    }
    setEditInitial({
      id: po.id,
      supplier_id: po.supplier_id,
      outlet_ids: po.outlet_ids,
      notes: po.notes,
      expected_delivery: po.expected_delivery,
      items: res.data ?? [],
    });
    setEditOpen(true);
  }

  async function openReceive() {
    setError(null);
    const res = await getPOItemsForReceive(po.id);
    if ('error' in res && res.error) {
      setError(`Load items gagal: ${res.error}`);
      return;
    }
    setReceiveItems(res.data ?? []);
    setReceiveOpen(true);
  }

  function openWA() {
    if (!po.supplier_whatsapp) {
      setError('Supplier belum punya WhatsApp number');
      return;
    }
    const digits = po.supplier_whatsapp.replace(/\D/g, '');
    const text = encodeURIComponent(buildWaMessage(po));
    window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener');
  }

  function sendViaGateway(provider: WaProvider) {
    setError(null);
    setWaInfo(null);
    startTransition(async () => {
      const res = await sendPOWhatsApp(po.id, provider);
      if ('error' in res && res.error) {
        setError(`${provider}: ${res.error}`);
        return;
      }
      setWaInfo(
        `Berhasil kirim via ${provider}${res.data?.messageId ? ` (msg ${res.data.messageId})` : ''}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Aksi</h2>
      <div className="flex flex-wrap gap-2">
        {po.status === 'draft' && permissions.create ? (
          <>
            <Button size="sm" variant="outline" onClick={openEdit} disabled={pending}>
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
              Edit Draft
            </Button>
            <Button size="sm" onClick={() => run('Submit', () => submitPO(po.id))} disabled={pending}>
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              ) : (
                <Send className="h-3 w-3" strokeWidth={1.5} />
              )}
              Submit untuk Approval
            </Button>
          </>
        ) : null}

        {po.status === 'submitted' && permissions.approve ? (
          <>
            <Button size="sm" onClick={() => run('Approve', () => approvePO(po.id))} disabled={pending}>
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run('Reject', () => rejectPO(po.id, 'Dikembalikan ke draft'))}
              disabled={pending}
            >
              <XCircle className="h-3 w-3 text-warning" strokeWidth={1.5} />
              Reject ke Draft
            </Button>
          </>
        ) : null}

        {(po.status === 'approved' || po.status === 'wa_sent') && permissions.create ? (
          <>
            {permissions.sendWa ? (
              <>
                <Button size="sm" variant="lime" onClick={openWA} disabled={pending}>
                  <MessageCircle className="h-3 w-3" strokeWidth={1.5} />
                  Buka WA Manual
                </Button>
                {waProviders.includes('fonnte') ? (
                  <Button
                    size="sm"
                    variant="lime"
                    onClick={() => sendViaGateway('fonnte')}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Zap className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    Kirim via Fonnte
                  </Button>
                ) : null}
                {waProviders.includes('kirimchat') ? (
                  <Button
                    size="sm"
                    variant="lime"
                    onClick={() => sendViaGateway('kirimchat')}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Zap className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    Kirim via KirimChat
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              size="sm"
              onClick={() => run('Mark Ordered', () => markPOOrdered(po.id))}
              disabled={pending}
            >
              <ShoppingCart className="h-3 w-3" strokeWidth={1.5} />
              Tandai Sudah Order
            </Button>
          </>
        ) : null}

        {(po.status === 'ordered' || po.status === 'partial_received' || po.status === 'wa_sent') &&
        permissions.receive ? (
          <Button size="sm" variant="lime" onClick={openReceive} disabled={pending}>
            <Package className="h-3 w-3" strokeWidth={1.5} />
            Receive Barang
          </Button>
        ) : null}

        {po.status !== 'received' && po.status !== 'cancelled' && permissions.approve ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run('Cancel', () => cancelPO(po.id, 'Dibatalkan dari detail page'))
            }
            disabled={pending}
          >
            <XCircle className="h-3 w-3 text-danger" strokeWidth={1.5} />
            Batalkan PO
          </Button>
        ) : null}

        {po.status === 'received' ? (
          <span className="inline-flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
            PO selesai diterima penuh
          </span>
        ) : null}
        {po.status === 'cancelled' ? (
          <span className="inline-flex items-center gap-2 text-xs text-danger">
            <XCircle className="h-3 w-3" strokeWidth={1.5} />
            PO dibatalkan
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      {waInfo ? (
        <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{waInfo}</p>
      ) : null}

      {permissions.create ? (
        <POFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={editInitial}
          suppliers={suppliers}
          bahanOptions={bahanOptions}
          outlets={outlets}
          onSuccess={() => router.refresh()}
        />
      ) : null}
      {permissions.receive ? (
        <POReceiveDialog
          poId={po.id}
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          items={receiveItems}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

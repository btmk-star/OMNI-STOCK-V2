'use client';

import { useState, useTransition } from 'react';
import { Loader2, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { receivePO } from '@/lib/actions/po.actions';
import { formatNumber } from '@/lib/utils/format';

export interface ReceiveItem {
  id: string;
  bahan_id: string | null;
  bahan_name: string | null;
  qty: number;
  qty_received: number;
  satuan: string | null;
}

interface Props {
  poId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReceiveItem[];
  onSuccess?: () => void;
}

export function POReceiveDialog({ poId, open, onOpenChange, items, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [receipts, setReceipts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const it of items) init[it.id] = it.qty_received;
    return init;
  });

  function update(id: string, value: number) {
    setReceipts((prev) => ({ ...prev, [id]: value }));
  }

  function fillFull() {
    const next: Record<string, number> = {};
    for (const it of items) next[it.id] = it.qty;
    setReceipts(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      receipts: items.map((it) => ({
        item_id: it.id,
        qty_received: receipts[it.id] ?? 0,
      })),
      notes: notes || null,
    };
    startTransition(async () => {
      const res = await receivePO(poId, payload);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Receive Barang · {poId}</DialogTitle>
          <DialogDescription>
            Update qty diterima per item. Status PO otomatis berubah ke{' '}
            <strong>received</strong> kalau semua item full, atau <strong>partial_received</strong>{' '}
            kalau sebagian.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={fillFull}>
              Isi semua = qty order
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-cream/30 text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 text-left">Bahan</th>
                  <th className="px-3 py-2 text-right">Qty Order</th>
                  <th className="px-3 py-2 text-right">Qty Diterima</th>
                  <th className="px-3 py-2 text-left">Satuan</th>
                  <th className="px-3 py-2 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const got = receipts[it.id] ?? 0;
                  const diff = got - it.qty;
                  return (
                    <tr key={it.id} className="border-b border-border-default/50">
                      <td className="px-3 py-2">
                        <div className="text-text-primary">
                          {it.bahan_name ?? it.bahan_id ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatNumber(it.qty)}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={got}
                          onChange={(e) => update(it.id, Number.parseFloat(e.target.value) || 0)}
                          className="h-9 w-24 text-right font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{it.satuan ?? '—'}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          diff < 0 ? 'text-warning' : diff > 0 ? 'text-success' : 'text-text-muted'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {formatNumber(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Catatan Penerimaan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kondisi barang, kekurangan, dst (opsional)"
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
              maxLength={1000}
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Package className="h-4 w-4" strokeWidth={1.5} />
              )}
              Simpan Penerimaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

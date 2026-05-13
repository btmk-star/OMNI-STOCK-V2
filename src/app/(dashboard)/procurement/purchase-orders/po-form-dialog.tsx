'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
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
import { createPO, updatePODraft, type POInput, type POItemInput } from '@/lib/actions/po.actions';
import { formatCurrency } from '@/lib/utils/format';

export interface SupplierOption {
  id: string;
  name: string;
  whatsapp: string | null;
}

export interface BahanOption {
  id: string;
  name: string;
  satuan_dapur: string | null;
  harga_beli: number | null;
}

export interface POFormInitial {
  id: string;
  supplier_id: string;
  outlet_ids: string[];
  notes: string | null;
  expected_delivery: string | null;
  items: POItemInput[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: POFormInitial | null;
  suppliers: SupplierOption[];
  bahanOptions: BahanOption[];
  outlets: string[];
  onSuccess?: (id: string) => void;
}

export function POFormDialog({
  open,
  onOpenChange,
  initial,
  suppliers,
  bahanOptions,
  outlets,
  onSuccess,
}: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? '');
  const [outletIds, setOutletIds] = useState<string[]>(initial?.outlet_ids ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [expectedDelivery, setExpectedDelivery] = useState(initial?.expected_delivery ?? '');
  const [items, setItems] = useState<POItemInput[]>(
    initial?.items?.length
      ? initial.items
      : [{ bahan_id: '', qty: 1, satuan: '', harga_satuan: 0 }],
  );

  function addItem() {
    setItems((prev) => [...prev, { bahan_id: '', qty: 1, satuan: '', harga_satuan: 0 }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateItem<K extends keyof POItemInput>(idx: number, key: K, value: POItemInput[K]) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }
  function pickBahan(idx: number, bahanId: string) {
    const bahan = bahanOptions.find((b) => b.id === bahanId);
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        bahan_id: bahanId,
        satuan: bahan?.satuan_dapur ?? next[idx].satuan,
        harga_satuan: bahan?.harga_beli ?? next[idx].harga_satuan,
      };
      return next;
    });
  }

  function toggleOutlet(o: string) {
    setOutletIds((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );
  }

  const totalAmount = items.reduce(
    (s, it) => s + (it.qty || 0) * (it.harga_satuan ?? 0),
    0,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanItems = items.filter((it) => it.bahan_id && it.qty > 0);
    if (!supplierId) {
      setError('Supplier wajib dipilih');
      return;
    }
    if (cleanItems.length === 0) {
      setError('Minimal 1 item dengan bahan + qty > 0');
      return;
    }
    const payload: POInput = {
      supplier_id: supplierId,
      outlet_ids: outletIds,
      notes: notes || null,
      expected_delivery: expectedDelivery || null,
      items: cleanItems,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updatePODraft(initial!.id, payload)
        : await createPO(payload);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      if (res.data) onSuccess?.(res.data.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit PO Draft · ${initial!.id}` : 'Buat Purchase Order Baru'}
          </DialogTitle>
          <DialogDescription>
            PO awal status <strong>draft</strong>. Setelah simpan, gunakan tombol Submit di
            detail page untuk approval flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                required
              >
                <option value="">— pilih supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.whatsapp ? ` (${s.whatsapp})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">
                Estimasi Tanggal Kirim
              </label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Outlet (multi-select)</label>
              <div className="flex flex-wrap gap-2">
                {outlets.length === 0 ? (
                  <span className="text-xs text-text-muted">— belum ada outlet —</span>
                ) : (
                  outlets.map((o) => (
                    <label
                      key={o}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono ${
                        outletIds.includes(o)
                          ? 'border-teal bg-teal text-white'
                          : 'border-border-default bg-surface text-text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={outletIds.includes(o)}
                        onChange={() => toggleOutlet(o)}
                        className="hidden"
                      />
                      {o}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-default bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                placeholder="Catatan tambahan untuk supplier (akan ditampilkan di template WA)"
                maxLength={2000}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border-default">
            <div className="flex items-center justify-between border-b border-border-default bg-cream/30 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Items ({items.length})
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>
                <Plus className="h-3 w-3" strokeWidth={1.5} />
                Tambah Item
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="px-3 py-2 text-left">Bahan</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-left">Satuan</th>
                    <th className="px-3 py-2 text-right">Harga Satuan</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const subtotal = (it.qty || 0) * (it.harga_satuan ?? 0);
                    return (
                      <tr key={idx} className="border-b border-border-default/50">
                        <td className="px-3 py-2">
                          <select
                            value={it.bahan_id}
                            onChange={(e) => pickBahan(idx, e.target.value)}
                            className="h-9 w-full rounded-lg border border-border-default bg-surface px-2 text-sm text-text-primary"
                            required
                          >
                            <option value="">— pilih bahan —</option>
                            {bahanOptions.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={it.qty}
                            onChange={(e) =>
                              updateItem(idx, 'qty', Number.parseFloat(e.target.value) || 0)
                            }
                            className="h-9 w-20 text-right"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={it.satuan ?? ''}
                            onChange={(e) => updateItem(idx, 'satuan', e.target.value)}
                            className="h-9 w-20"
                            maxLength={50}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={it.harga_satuan ?? ''}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                'harga_satuan',
                                e.target.value === '' ? null : Number.parseFloat(e.target.value),
                              )
                            }
                            className="h-9 w-28 text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(idx)}
                            disabled={items.length === 1}
                            title="Hapus"
                          >
                            <Trash2 className="h-3 w-3 text-danger" strokeWidth={1.5} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-mint/30">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase text-forest">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-teal">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
                <Save className="h-4 w-4" strokeWidth={1.5} />
              )}
              {isEdit ? 'Simpan Draft' : 'Buat PO Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

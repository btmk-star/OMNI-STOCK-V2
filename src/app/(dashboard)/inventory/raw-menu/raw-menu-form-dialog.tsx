'use client';

import { useEffect, useState, useTransition } from 'react';
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
import {
  createRawMenu,
  updateRawMenu,
  type RawMenuInput,
  type RawMenuItemInput,
} from '@/lib/actions/raw-menu.actions';
import { formatCurrency } from '@/lib/utils/format';

export interface BahanOption {
  id: string;
  name: string;
  satuan_dapur: string | null;
  harga_per_porsi: number | null;
}

export interface RawMenuFormInitial {
  id: string;
  name: string;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  items: RawMenuItemInput[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RawMenuFormInitial | null;
  bahanOptions: BahanOption[];
  onSuccess?: () => void;
}

export function RawMenuFormDialog({
  open,
  onOpenChange,
  initial,
  bahanOptions,
  onSuccess,
}: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [satuanHasil, setSatuanHasil] = useState(initial?.satuan_hasil ?? '');
  const [jumlahHasil, setJumlahHasil] = useState<number>(initial?.jumlah_hasil ?? 1);
  const [items, setItems] = useState<RawMenuItemInput[]>(
    initial?.items?.length
      ? initial.items
      : [{ bahan_id: '', qty: 0, satuan: '', cost: 0, sort_order: 0 }],
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      { bahan_id: '', qty: 0, satuan: '', cost: 0, sort_order: prev.length },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateItem<K extends keyof RawMenuItemInput>(
    idx: number,
    key: K,
    value: RawMenuItemInput[K],
  ) {
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
        cost: bahan?.harga_per_porsi
          ? Math.round(bahan.harga_per_porsi * (next[idx].qty || 0) * 100) / 100
          : next[idx].cost,
      };
      return next;
    });
  }

  // Auto-recalc cost when qty changes
  useEffect(() => {
    setItems((prev) =>
      prev.map((it) => {
        const bahan = bahanOptions.find((b) => b.id === it.bahan_id);
        if (!bahan?.harga_per_porsi) return it;
        const cost = Math.round(bahan.harga_per_porsi * (it.qty || 0) * 100) / 100;
        return { ...it, cost };
      }),
    );
  }, [bahanOptions]);

  const totalCogs = items.reduce((s, it) => s + (it.cost ?? 0), 0);
  const cogsPerUnit = jumlahHasil > 0 ? totalCogs / jumlahHasil : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanItems = items.filter((it) => it.bahan_id);
    if (cleanItems.length === 0) {
      setError('Minimal 1 item bahan harus diisi');
      return;
    }
    const payload: RawMenuInput = {
      name,
      satuan_hasil: satuanHasil || null,
      jumlah_hasil: jumlahHasil,
      items: cleanItems,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateRawMenu(initial!.id, payload)
        : await createRawMenu(payload);
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Raw Menu · ${initial!.id}` : 'Tambah Raw Menu (SFG)'}
          </DialogTitle>
          <DialogDescription>
            Semi-finished goods dengan komposisi bahan. Cost per item auto-calc dari
            harga_per_porsi × qty bahan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Nama SFG *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Bumbu Dasar Mie"
                required
                minLength={2}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Jumlah Hasil *</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="any"
                  min={0.001}
                  value={jumlahHasil}
                  onChange={(e) => setJumlahHasil(Number.parseFloat(e.target.value) || 0)}
                  required
                  className="flex-1"
                />
                <Input
                  value={satuanHasil}
                  onChange={(e) => setSatuanHasil(e.target.value)}
                  placeholder="kg/L/pcs"
                  className="w-24"
                  maxLength={50}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border-default">
            <div className="flex items-center justify-between border-b border-border-default bg-cream/30 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Komposisi Bahan ({items.length})
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>
                <Plus className="h-3 w-3" strokeWidth={1.5} />
                Tambah Item
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="px-3 py-2 text-left">Bahan</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-left">Satuan</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
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
                          className="h-9 text-right"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={it.satuan ?? ''}
                          onChange={(e) => updateItem(idx, 'satuan', e.target.value)}
                          className="h-9 w-20"
                          maxLength={20}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={it.cost ?? ''}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'cost',
                              e.target.value === '' ? null : Number.parseFloat(e.target.value),
                            )
                          }
                          className="h-9 text-right font-mono"
                        />
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-mint/40 px-4 py-2 text-xs text-forest">
              Total COGS:{' '}
              <span className="font-mono font-semibold">{formatCurrency(totalCogs)}</span>
            </div>
            <div className="rounded-lg bg-mint/40 px-4 py-2 text-xs text-forest">
              COGS per {satuanHasil || 'unit'}:{' '}
              <span className="font-mono font-semibold">{formatCurrency(cogsPerUnit)}</span>
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
              {isEdit ? 'Simpan Perubahan' : 'Tambah Raw Menu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

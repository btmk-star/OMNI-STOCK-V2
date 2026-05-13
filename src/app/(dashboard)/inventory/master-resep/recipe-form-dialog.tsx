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
import { Badge } from '@/components/ui/badge';
import {
  createRecipe,
  updateRecipe,
  type RecipeInput,
  type RecipeItemInput,
} from '@/lib/actions/recipe.actions';
import { formatCurrency } from '@/lib/utils/format';

export interface BahanOption {
  id: string;
  name: string;
  satuan_dapur: string | null;
  harga_per_porsi: number | null;
}

export interface RawMenuOption {
  id: string;
  name: string;
  satuan_hasil: string | null;
  cogs_per_unit: number | null;
}

export interface MenuOption {
  id: string;
  name: string;
}

export interface RecipeFormInitial {
  id: string;
  name: string;
  menu_id: string | null;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  items: RecipeItemInput[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RecipeFormInitial | null;
  bahanOptions: BahanOption[];
  rawMenuOptions: RawMenuOption[];
  menuOptions: MenuOption[];
  onSuccess?: () => void;
}

export function RecipeFormDialog({
  open,
  onOpenChange,
  initial,
  bahanOptions,
  rawMenuOptions,
  menuOptions,
  onSuccess,
}: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [menuId, setMenuId] = useState(initial?.menu_id ?? '');
  const [satuanHasil, setSatuanHasil] = useState(initial?.satuan_hasil ?? 'porsi');
  const [jumlahHasil, setJumlahHasil] = useState<number>(initial?.jumlah_hasil ?? 1);
  const [items, setItems] = useState<RecipeItemInput[]>(
    initial?.items?.length
      ? initial.items
      : [
          {
            item_type: 'bahan',
            bahan_id: '',
            raw_menu_id: null,
            qty: 0,
            satuan: '',
            cost: 0,
            sort_order: 0,
          },
        ],
  );

  function addItem(type: 'bahan' | 'raw_menu') {
    setItems((prev) => [
      ...prev,
      {
        item_type: type,
        bahan_id: type === 'bahan' ? '' : null,
        raw_menu_id: type === 'raw_menu' ? '' : null,
        qty: 0,
        satuan: '',
        cost: 0,
        sort_order: prev.length,
      },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateItem<K extends keyof RecipeItemInput>(
    idx: number,
    key: K,
    value: RecipeItemInput[K],
  ) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }
  function pickItem(idx: number, sourceId: string) {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[idx];
      if (cur.item_type === 'bahan') {
        const bahan = bahanOptions.find((b) => b.id === sourceId);
        next[idx] = {
          ...cur,
          bahan_id: sourceId,
          satuan: bahan?.satuan_dapur ?? cur.satuan,
          cost: bahan?.harga_per_porsi
            ? Math.round(bahan.harga_per_porsi * (cur.qty || 0) * 100) / 100
            : cur.cost,
        };
      } else {
        const rm = rawMenuOptions.find((r) => r.id === sourceId);
        next[idx] = {
          ...cur,
          raw_menu_id: sourceId,
          satuan: rm?.satuan_hasil ?? cur.satuan,
          cost: rm?.cogs_per_unit
            ? Math.round(rm.cogs_per_unit * (cur.qty || 0) * 100) / 100
            : cur.cost,
        };
      }
      return next;
    });
  }
  function recalcCostOnQty(idx: number, qty: number) {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[idx];
      let cost = cur.cost;
      if (cur.item_type === 'bahan' && cur.bahan_id) {
        const bahan = bahanOptions.find((b) => b.id === cur.bahan_id);
        if (bahan?.harga_per_porsi != null) {
          cost = Math.round(bahan.harga_per_porsi * qty * 100) / 100;
        }
      } else if (cur.item_type === 'raw_menu' && cur.raw_menu_id) {
        const rm = rawMenuOptions.find((r) => r.id === cur.raw_menu_id);
        if (rm?.cogs_per_unit != null) {
          cost = Math.round(rm.cogs_per_unit * qty * 100) / 100;
        }
      }
      next[idx] = { ...cur, qty, cost };
      return next;
    });
  }

  const totalCogs = items.reduce((s, it) => s + (it.cost ?? 0), 0);
  const cogsPerUnit = jumlahHasil > 0 ? totalCogs / jumlahHasil : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanItems = items.filter(
      (it) =>
        (it.item_type === 'bahan' && it.bahan_id) ||
        (it.item_type === 'raw_menu' && it.raw_menu_id),
    );
    if (cleanItems.length === 0) {
      setError('Minimal 1 item harus dipilih');
      return;
    }
    const payload: RecipeInput = {
      name,
      menu_id: menuId || null,
      satuan_hasil: satuanHasil || null,
      jumlah_hasil: jumlahHasil,
      items: cleanItems,
    };
    startTransition(async () => {
      const res = isEdit ? await updateRecipe(initial!.id, payload) : await createRecipe(payload);
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Resep · ${initial!.id}` : 'Tambah Resep Baru'}
          </DialogTitle>
          <DialogDescription>
            BoM (Bill of Materials) untuk satu menu. Items bisa pilih bahan baku atau raw menu (SFG).
            Cost auto-recalc dari harga ÷ qty.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Nama Resep *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Mie Ayam Spesial"
                required
                minLength={2}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Hasil per Resep *</label>
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
                  placeholder="porsi"
                  className="w-24"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs font-medium text-text-secondary">Link ke Menu (optional)</label>
              <select
                value={menuId}
                onChange={(e) => setMenuId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
              >
                <option value="">— belum di-link —</option>
                {menuOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border-default">
            <div className="flex items-center justify-between border-b border-border-default bg-cream/30 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Komposisi ({items.length})
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addItem('bahan')}
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Bahan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addItem('raw_menu')}
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Raw Menu
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="px-3 py-2 text-left">Tipe</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-left">Satuan</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const sourceId =
                      it.item_type === 'bahan' ? it.bahan_id ?? '' : it.raw_menu_id ?? '';
                    const optionsList = it.item_type === 'bahan' ? bahanOptions : rawMenuOptions;
                    return (
                      <tr key={idx} className="border-b border-border-default/50">
                        <td className="px-3 py-2">
                          <Badge variant={it.item_type === 'bahan' ? 'typePackaged' : 'typeRawBulk'}>
                            {it.item_type === 'bahan' ? 'Bahan' : 'SFG'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={sourceId}
                            onChange={(e) => pickItem(idx, e.target.value)}
                            className="h-9 w-full rounded-lg border border-border-default bg-surface px-2 text-sm text-text-primary"
                            required
                          >
                            <option value="">
                              — pilih {it.item_type === 'bahan' ? 'bahan' : 'raw menu'} —
                            </option>
                            {optionsList.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
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
                              recalcCostOnQty(idx, Number.parseFloat(e.target.value) || 0)
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
                    );
                  })}
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
              {isEdit ? 'Simpan Perubahan' : 'Tambah Resep'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

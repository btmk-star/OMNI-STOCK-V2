'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
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
import { createMenu, updateMenu, type MenuInput } from '@/lib/actions/menu.actions';
import { formatCurrency } from '@/lib/utils/format';
import type { MenuRow } from './menu-table';

interface RecipeOption {
  id: string;
  name: string;
  total_cogs: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: MenuRow | null;
  recipes: RecipeOption[];
  outlets: string[];
  kategoriOptions: string[];
  channelOptions: string[];
  onSuccess?: () => void;
}

const DEFAULT_CHANNELS = ['Dine In', 'GrabFood', 'GoFood', 'ShopeeFood', 'Take Away'];
const DEFAULT_KATEGORIS = ['food', 'beverage', 'snack', 'dessert', 'addon'];

export function MenuFormDialog({
  open,
  onOpenChange,
  initial,
  recipes,
  outlets,
  kategoriOptions,
  channelOptions,
  onSuccess,
}: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MenuInput>(() => ({
    name: initial?.name ?? '',
    kategori: initial?.kategori ?? '',
    channel: initial?.channel ?? '',
    outlet_id: initial?.outlet_id ?? '',
    recipe_id: initial?.recipe_id ?? '',
    harga_jual: initial?.harga_jual ?? null,
    pawoon_product_id: initial?.pawoon_product_id ?? '',
  }));

  function update<K extends keyof MenuInput>(key: K, value: MenuInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedRecipe = recipes.find((r) => r.id === form.recipe_id);
  const previewCogs = selectedRecipe?.total_cogs ?? null;
  const previewMargin =
    form.harga_jual && previewCogs && form.harga_jual > 0
      ? ((form.harga_jual - previewCogs) / form.harga_jual) * 100
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = isEdit ? await updateMenu(initial!.id, form) : await createMenu(form);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.();
    });
  }

  const allChannels = Array.from(
    new Set([...channelOptions, ...DEFAULT_CHANNELS]),
  ).sort();
  const allKategoris = Array.from(
    new Set([...kategoriOptions, ...DEFAULT_KATEGORIS]),
  ).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Menu · ${initial!.id}` : 'Tambah Menu Baru'}</DialogTitle>
          <DialogDescription>
            COGS + margin dihitung otomatis dari resep yang di-link. Pawoon Product ID untuk link
            ke produk Pawoon (optional).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Menu *" htmlFor="mname" full>
              <Input
                id="mname"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="contoh: Mie Ayam Spesial"
                required
                minLength={2}
                maxLength={255}
              />
            </Field>

            <Field label="Kategori" htmlFor="mkat">
              <input
                id="mkat"
                list="mkat-list"
                value={form.kategori ?? ''}
                onChange={(e) => update('kategori', e.target.value)}
                placeholder="food / beverage"
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                maxLength={100}
              />
              <datalist id="mkat-list">
                {allKategoris.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>

            <Field label="Channel" htmlFor="mchan">
              <input
                id="mchan"
                list="mchan-list"
                value={form.channel ?? ''}
                onChange={(e) => update('channel', e.target.value)}
                placeholder="Dine In / GrabFood"
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                maxLength={50}
              />
              <datalist id="mchan-list">
                {allChannels.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Outlet" htmlFor="moutlet">
              <select
                id="moutlet"
                value={form.outlet_id ?? ''}
                onChange={(e) => update('outlet_id', e.target.value || null)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
              >
                <option value="">— semua outlet —</option>
                {outlets.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Resep" htmlFor="mrecipe">
              <select
                id="mrecipe"
                value={form.recipe_id ?? ''}
                onChange={(e) => update('recipe_id', e.target.value || null)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
              >
                <option value="">— belum di-link —</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.total_cogs != null ? ` · ${formatCurrency(r.total_cogs)}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Harga Jual (Rp)" htmlFor="mharga">
              <Input
                id="mharga"
                type="number"
                min={0}
                step="any"
                value={form.harga_jual ?? ''}
                onChange={(e) =>
                  update(
                    'harga_jual',
                    e.target.value === '' ? null : Number.parseFloat(e.target.value),
                  )
                }
                placeholder="contoh: 25000"
              />
            </Field>

            <Field label="Pawoon Product ID" htmlFor="mpaw" full>
              <Input
                id="mpaw"
                value={form.pawoon_product_id ?? ''}
                onChange={(e) => update('pawoon_product_id', e.target.value)}
                placeholder="UUID dari pawoon_products (kosongkan kalau menu manual)"
                maxLength={50}
              />
            </Field>
          </div>

          {previewCogs != null || previewMargin != null ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-mint/40 px-4 py-2 text-xs text-forest">
                COGS preview: <span className="font-mono font-semibold">{previewCogs != null ? formatCurrency(previewCogs) : '—'}</span>
              </div>
              <div className="rounded-lg bg-mint/40 px-4 py-2 text-xs text-forest">
                Margin: <span className={`font-mono font-semibold ${previewMargin != null && previewMargin >= 60 ? 'text-success' : previewMargin != null && previewMargin >= 30 ? 'text-warning' : 'text-danger'}`}>{previewMargin != null ? `${previewMargin.toFixed(1)}%` : '—'}</span>
              </div>
            </div>
          ) : null}

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
              {isEdit ? 'Simpan Perubahan' : 'Tambah Menu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
  full,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${full ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

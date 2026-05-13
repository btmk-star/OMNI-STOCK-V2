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
import { createBahan, updateBahan, type BahanInput } from '@/lib/actions/bahan.actions';
import { formatCurrency } from '@/lib/utils/format';
import type { BahanRow } from './bahan-table';

interface SupplierOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BahanRow | null;
  suppliers: SupplierOption[];
  outlets: string[];
  kategoriOptions: string[];
  onSuccess?: () => void;
}

const SATUAN_OPTIONS = ['kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack', 'butir', 'lembar', 'porsi'];

export function BahanFormDialog({
  open,
  onOpenChange,
  initial,
  suppliers,
  outlets,
  kategoriOptions,
  onSuccess,
}: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<BahanInput>(() => ({
    name: initial?.name ?? '',
    tipe: initial?.tipe ?? 'packaged',
    kategori: initial?.kategori ?? '',
    outlet_id: initial?.outlet_id ?? '',
    supplier_id: initial?.supplier_id ?? '',
    kemasan_beli: initial?.kemasan_beli ?? '',
    satuan_dapur: initial?.satuan_dapur ?? '',
    min_stok: initial?.min_stok ?? null,
    min_stok_unit: initial?.min_stok_unit ?? '',
    harga_beli: initial?.harga_beli ?? null,
    isi_yield: initial?.isi_yield ?? null,
  }));

  function update<K extends keyof BahanInput>(key: K, value: BahanInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const previewHargaPerPorsi =
    form.harga_beli && form.isi_yield && form.isi_yield > 0
      ? form.harga_beli / form.isi_yield
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = isEdit ? await updateBahan(initial!.id, form) : await createBahan(form);
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
          <DialogTitle>
            {isEdit ? `Edit Bahan · ${initial!.id}` : 'Tambah Bahan Baru'}
          </DialogTitle>
          <DialogDescription>
            Field <span className="text-danger">*</span> wajib. Harga/porsi dihitung otomatis dari
            harga beli ÷ isi yield.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Bahan *" htmlFor="bname" full>
              <Input
                id="bname"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="contoh: Ayam Fillet 500gr"
                required
                minLength={2}
                maxLength={255}
              />
            </Field>

            <Field label="Tipe *" htmlFor="tipe">
              <select
                id="tipe"
                value={form.tipe}
                onChange={(e) => update('tipe', e.target.value as BahanInput['tipe'])}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                required
              >
                <option value="packaged">Packaged (sudah kemasan)</option>
                <option value="raw_bulk">Raw Bulk (dijual berat)</option>
              </select>
            </Field>

            <Field label="Kategori" htmlFor="kategori">
              <input
                id="kategori"
                list="kategori-list"
                value={form.kategori ?? ''}
                onChange={(e) => update('kategori', e.target.value)}
                placeholder="contoh: Frozen, Sayur"
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                maxLength={100}
              />
              <datalist id="kategori-list">
                {kategoriOptions.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>

            <Field label="Outlet" htmlFor="outlet">
              <select
                id="outlet"
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

            <Field label="Supplier" htmlFor="supplier">
              <select
                id="supplier"
                value={form.supplier_id ?? ''}
                onChange={(e) => update('supplier_id', e.target.value || null)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
              >
                <option value="">— belum di-link —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kemasan Beli" htmlFor="kb">
              <Input
                id="kb"
                value={form.kemasan_beli ?? ''}
                onChange={(e) => update('kemasan_beli', e.target.value)}
                placeholder="contoh: pack 500gr"
                maxLength={50}
              />
            </Field>

            <Field label="Satuan Dapur" htmlFor="sd">
              <input
                id="sd"
                list="satuan-list"
                value={form.satuan_dapur ?? ''}
                onChange={(e) => update('satuan_dapur', e.target.value)}
                placeholder="kg / g / L / pcs"
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                maxLength={20}
              />
              <datalist id="satuan-list">
                {SATUAN_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>

            <Field label="Harga Beli (Rp)" htmlFor="hb">
              <Input
                id="hb"
                type="number"
                min={0}
                step="any"
                value={form.harga_beli ?? ''}
                onChange={(e) =>
                  update(
                    'harga_beli',
                    e.target.value === '' ? null : Number.parseFloat(e.target.value),
                  )
                }
                placeholder="contoh: 25000"
              />
            </Field>

            <Field label="Isi Yield (per kemasan)" htmlFor="iy">
              <Input
                id="iy"
                type="number"
                min={0}
                step="any"
                value={form.isi_yield ?? ''}
                onChange={(e) =>
                  update(
                    'isi_yield',
                    e.target.value === '' ? null : Number.parseFloat(e.target.value),
                  )
                }
                placeholder="contoh: 10 (10 porsi per pack)"
              />
            </Field>

            <Field label="Min Stok" htmlFor="ms">
              <Input
                id="ms"
                type="number"
                min={0}
                step="any"
                value={form.min_stok ?? ''}
                onChange={(e) =>
                  update(
                    'min_stok',
                    e.target.value === '' ? null : Number.parseFloat(e.target.value),
                  )
                }
                placeholder="contoh: 5"
              />
            </Field>

            <Field label="Min Stok Unit" htmlFor="msu">
              <Input
                id="msu"
                value={form.min_stok_unit ?? ''}
                onChange={(e) => update('min_stok_unit', e.target.value)}
                placeholder="kg / pack / pcs"
                maxLength={20}
              />
            </Field>
          </div>

          {previewHargaPerPorsi !== null ? (
            <div className="rounded-lg bg-mint/40 px-4 py-2 text-xs text-forest">
              Preview <span className="font-semibold">Harga/Porsi</span>:{' '}
              <span className="font-mono">{formatCurrency(previewHargaPerPorsi)}</span>
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
              {isEdit ? 'Simpan Perubahan' : 'Tambah Bahan'}
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

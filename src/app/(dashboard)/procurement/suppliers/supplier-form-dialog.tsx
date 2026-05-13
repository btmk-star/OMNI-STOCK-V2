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
import {
  createSupplier,
  updateSupplier,
  type SupplierInput,
} from '@/lib/actions/suppliers.actions';
import type { SupplierRow } from './suppliers-table';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SupplierRow | null;
  onSuccess?: () => void;
}

const TYPE_OPTIONS: Array<{ value: SupplierInput['type']; label: string }> = [
  { value: 'kerjasama', label: 'Kerjasama' },
  { value: 'non_kerjasama', label: 'Non-kerjasama' },
  { value: 'online_shop', label: 'Online Shop' },
];

const PAYMENT_OPTIONS = ['Cash', 'COD', 'Net 7', 'Net 14', 'Net 30', 'Net 60'];

export function SupplierFormDialog({ open, onOpenChange, initial, onSuccess }: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<SupplierInput>(() => ({
    name: initial?.name ?? '',
    type: initial?.type ?? 'kerjasama',
    contact_person: initial?.contact_person ?? '',
    phone: initial?.phone ?? '',
    whatsapp: initial?.whatsapp ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    payment_terms: initial?.payment_terms ?? '',
    lead_time_days: initial?.lead_time_days ?? null,
    rating: initial?.rating ?? null,
    notes: initial?.notes ?? '',
  }));

  function update<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = isEdit
        ? await updateSupplier(initial!.id, form)
        : await createSupplier(form);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Supplier · ${initial!.id}` : 'Tambah Supplier Baru'}</DialogTitle>
          <DialogDescription>
            Lengkapi data supplier. Field bertanda <span className="text-danger">*</span> wajib diisi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Supplier *" htmlFor="name" full>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="contoh: Lestari Chicken"
                required
                minLength={2}
                maxLength={255}
              />
            </Field>

            <Field label="Tipe *" htmlFor="type">
              <select
                id="type"
                value={form.type}
                onChange={(e) => update('type', e.target.value as SupplierInput['type'])}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                required
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Contact Person" htmlFor="cp">
              <Input
                id="cp"
                value={form.contact_person ?? ''}
                onChange={(e) => update('contact_person', e.target.value)}
                placeholder="contoh: Pak Budi"
                maxLength={255}
              />
            </Field>

            <Field label="WhatsApp" htmlFor="wa">
              <Input
                id="wa"
                value={form.whatsapp ?? ''}
                onChange={(e) => update('whatsapp', e.target.value)}
                placeholder="62812xxxx (format ID, no +)"
                maxLength={20}
                inputMode="tel"
              />
            </Field>

            <Field label="Telepon" htmlFor="phone">
              <Input
                id="phone"
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="021-xxx atau 0812xxx"
                maxLength={20}
                inputMode="tel"
              />
            </Field>

            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
                placeholder="supplier@domain.com"
                maxLength={255}
              />
            </Field>

            <Field label="Payment Terms" htmlFor="pt">
              <select
                id="pt"
                value={form.payment_terms ?? ''}
                onChange={(e) => update('payment_terms', e.target.value || null)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
              >
                <option value="">— pilih —</option>
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lead Time (hari)" htmlFor="lt">
              <Input
                id="lt"
                type="number"
                min={0}
                max={365}
                value={form.lead_time_days ?? ''}
                onChange={(e) =>
                  update(
                    'lead_time_days',
                    e.target.value === '' ? null : Number.parseInt(e.target.value, 10),
                  )
                }
                placeholder="contoh: 2"
              />
            </Field>

            <Field label="Rating (0-5)" htmlFor="rating">
              <Input
                id="rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.rating ?? ''}
                onChange={(e) =>
                  update(
                    'rating',
                    e.target.value === '' ? null : Number.parseFloat(e.target.value),
                  )
                }
                placeholder="contoh: 4.5"
              />
            </Field>

            <Field label="Alamat" htmlFor="address" full>
              <textarea
                id="address"
                value={form.address ?? ''}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Alamat lengkap supplier"
                rows={2}
                className="w-full rounded-lg border border-border-default bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                maxLength={2000}
              />
            </Field>

            <Field label="Catatan" htmlFor="notes" full>
              <textarea
                id="notes"
                value={form.notes ?? ''}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Catatan internal (opsional)"
                rows={2}
                className="w-full rounded-lg border border-border-default bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                maxLength={2000}
              />
            </Field>
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
              {isEdit ? 'Simpan Perubahan' : 'Tambah Supplier'}
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

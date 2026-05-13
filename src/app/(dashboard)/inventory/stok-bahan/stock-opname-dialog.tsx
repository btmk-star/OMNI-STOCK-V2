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
import { recordStockOpname } from '@/lib/actions/stock.actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bahanId: string;
  bahanName: string;
  outletId: string | null;
  satuanDapur: string | null;
  currentComputed: number | null;
  onSuccess?: () => void;
}

export function StockOpnameDialog({
  open,
  onOpenChange,
  bahanId,
  bahanName,
  outletId,
  satuanDapur,
  currentComputed,
  onSuccess,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<string>(
    currentComputed != null ? String(currentComputed) : '',
  );
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qtyNum = Number.parseFloat(qty);
    if (!Number.isFinite(qtyNum) || qtyNum < 0) {
      setError('Qty harus angka >= 0');
      return;
    }
    startTransition(async () => {
      const res = await recordStockOpname({
        bahan_id: bahanId,
        outlet_id: outletId,
        qty_after: qtyNum,
        reason: reason || null,
      });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stok Opname · {bahanName}</DialogTitle>
          <DialogDescription>
            Input qty aktual hasil hitungan fisik. Ini jadi baseline baru — stok next-up dihitung
            dari sini + transaksi setelahnya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {currentComputed != null ? (
            <div className="rounded-lg bg-mint/30 px-3 py-2 text-xs text-forest">
              Stok terhitung sebelum opname:{' '}
              <span className="font-mono font-semibold">
                {currentComputed.toLocaleString('id-ID')} {satuanDapur ?? ''}
              </span>
              . Selisih akan ke-record sebagai <code>qty_diff</code>.
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor="qty" className="text-xs font-medium text-text-secondary">
              Stok Aktual *
            </label>
            <div className="flex gap-2">
              <Input
                id="qty"
                type="number"
                step="any"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="contoh: 25"
                required
                className="flex-1"
              />
              <div className="flex h-10 items-center rounded-lg border border-border-default bg-cream/50 px-3 text-sm text-text-muted">
                {satuanDapur ?? 'unit'}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="reason" className="text-xs font-medium text-text-secondary">
              Catatan (opsional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hasil opname Mingguan, atau kondisi spesial yg perlu di-note"
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
              maxLength={2000}
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
                <Save className="h-4 w-4" strokeWidth={1.5} />
              )}
              Simpan Opname
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  commitBulkOpname,
  previewBulkOpname,
  type BulkPreviewResult,
} from '@/lib/actions/stock.actions';
import { formatNumber } from '@/lib/utils/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'preview' | 'committing' | 'done';

export function BulkOpnameDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
  const [pending, startTransition] = useTransition();
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    failed: Array<{ bahan_id: string; error: string }>;
  } | null>(null);

  function reset() {
    setStep('upload');
    setFile(null);
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setActiveTab('matched');
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Pilih file XLS/CSV dulu');
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await previewBulkOpname(fd);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      if (res.data) {
        setPreview(res.data);
        setStep('preview');
      }
    });
  }

  function handleCommit() {
    if (!preview) return;
    setError(null);
    setStep('committing');
    startTransition(async () => {
      const res = await commitBulkOpname({
        rows: preview.matched.map((m) => ({
          bahan_id: m.bahan_id,
          qty_after: m.new_qty,
          current_baseline: m.current_baseline,
        })),
        source_filename: preview.source_filename,
      });
      if ('error' in res && res.error) {
        setError(res.error);
        setStep('preview');
        return;
      }
      if (res.data) {
        setCommitResult(res.data);
        setStep('done');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal" strokeWidth={1.5} />
            Bulk Opname dari File XLS/CSV
          </DialogTitle>
          <DialogDescription>
            Upload file Kartu Stok dari Pawoon (atau format apapun dengan kolom Nama + Stok Akhir).
            Auto-detect kolom + match by ID atau nama. Bahan tidak match → skip.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <div className="rounded-lg border border-dashed border-border-default p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-teal/60" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-text-primary">
                Pilih file (.xlsx, .xls, .csv)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-3 mx-auto block max-w-xs text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-teal/90"
              />
              {file ? (
                <p className="mt-2 text-xs text-text-muted">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              ) : null}
            </div>
            <div className="rounded-lg bg-mint/30 px-3 py-2 text-xs text-forest">
              <strong>Format dideteksi otomatis</strong> dari header baris pertama. Kolom yang
              dikenali: ID/SKU/Kode, Nama/Produk/Bahan, Stok Akhir/Qty/Jumlah, Outlet/Cabang.
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
                onClick={() => handleClose(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={pending || !file}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
                )}
                Preview
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === 'preview' && preview ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-mint/30 px-3 py-2">
                <p className="text-text-muted">Total baris data</p>
                <p className="font-mono font-bold text-text-primary">{preview.total_data_rows}</p>
              </div>
              <div className="rounded-lg bg-success/10 px-3 py-2">
                <p className="text-text-muted">Matched</p>
                <p className="font-mono font-bold text-success">{preview.matched.length}</p>
              </div>
              <div className="rounded-lg bg-warning/10 px-3 py-2">
                <p className="text-text-muted">Skip (unmatched)</p>
                <p className="font-mono font-bold text-warning">{preview.unmatched.length}</p>
              </div>
            </div>

            <div className="rounded-lg bg-cream/40 px-3 py-2 text-[11px] text-text-secondary">
              <strong>Kolom terdeteksi:</strong>{' '}
              {preview.detected_columns.id ? `ID="${preview.detected_columns.id}" · ` : ''}
              {preview.detected_columns.name ? `Nama="${preview.detected_columns.name}" · ` : ''}
              {preview.detected_columns.qty ? `Qty="${preview.detected_columns.qty}"` : ''}
              {preview.detected_columns.outlet ? ` · Outlet="${preview.detected_columns.outlet}"` : ''}
            </div>

            {preview.warnings.length > 0 ? (
              <ul className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex gap-2 border-b border-border-default">
              <button
                type="button"
                onClick={() => setActiveTab('matched')}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium ${
                  activeTab === 'matched'
                    ? 'border-teal text-teal'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                Matched ({preview.matched.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unmatched')}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium ${
                  activeTab === 'unmatched'
                    ? 'border-teal text-teal'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                Unmatched ({preview.unmatched.length})
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border-default">
              {activeTab === 'matched' ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-cream/80 backdrop-blur">
                    <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 text-left">Bahan</th>
                      <th className="px-3 py-2 text-right">Baseline Lama</th>
                      <th className="px-3 py-2 text-right">Qty Baru</th>
                      <th className="px-3 py-2 text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.matched.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-text-muted">
                          Tidak ada bahan match dari file ini.
                        </td>
                      </tr>
                    ) : (
                      preview.matched.map((m, i) => (
                        <tr key={i} className="border-b border-border-default/50">
                          <td className="px-3 py-2">
                            <div className="text-text-primary">{m.bahan_name}</div>
                            <div className="font-mono text-[10px] text-text-muted">
                              {m.bahan_id} · row {m.source_row}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            {m.current_baseline != null ? formatNumber(m.current_baseline) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatNumber(m.new_qty)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${
                              m.delta == null
                                ? 'text-text-muted'
                                : m.delta > 0
                                  ? 'text-success'
                                  : m.delta < 0
                                    ? 'text-danger'
                                    : 'text-text-muted'
                            }`}
                          >
                            {m.delta == null
                              ? '—'
                              : `${m.delta > 0 ? '+' : ''}${formatNumber(m.delta)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-cream/80 backdrop-blur">
                    <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Nama Source</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.unmatched.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-text-muted">
                          Tidak ada baris yang di-skip.
                        </td>
                      </tr>
                    ) : (
                      preview.unmatched.map((u, i) => (
                        <tr key={i} className="border-b border-border-default/50">
                          <td className="px-3 py-2 font-mono text-[12px] text-text-muted">
                            {u.source_row}
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] text-text-secondary">
                            {u.source_id ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {u.source_name ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            {u.source_qty != null ? formatNumber(u.source_qty) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
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
                onClick={() => {
                  setStep('upload');
                  setPreview(null);
                }}
              >
                Kembali / Upload Ulang
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || preview.matched.length === 0}
                onClick={handleCommit}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                )}
                Confirm & Commit ({preview.matched.length} bahan)
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === 'committing' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-teal" strokeWidth={1.5} />
            <p className="text-sm text-text-secondary">
              Menyimpan {preview?.matched.length ?? 0} baris ke os_stock_adjustments…
            </p>
          </div>
        ) : null}

        {step === 'done' && commitResult ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-success/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-success">
                  {commitResult.inserted} bahan ter-update sebagai opname baru.
                </p>
              </div>
              {commitResult.failed.length > 0 ? (
                <p className="mt-2 text-xs text-danger">
                  {commitResult.failed.length} gagal — lihat detail di bawah.
                </p>
              ) : null}
            </div>
            {commitResult.failed.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs">
                <p className="mb-2 font-semibold text-danger">Gagal:</p>
                <ul className="space-y-1">
                  {commitResult.failed.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-text-muted">{f.bahan_id}</span>
                      <span className="text-text-secondary">{f.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSuccess?.();
                  handleClose(false);
                }}
              >
                Selesai
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

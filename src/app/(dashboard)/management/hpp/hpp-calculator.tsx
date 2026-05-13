'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface RecipeOption {
  id: string;
  name: string;
  menu_id: string | null;
  os_master_menu: { name: string; harga_jual: number | null } | null;
}

interface RecipeDetail {
  id: string;
  name: string;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  total_cogs: number | null;
  cogs_per_unit: number | null;
  os_master_menu: { name: string; harga_jual: number | null } | null;
}

interface RecipeItem {
  id: string;
  bahan_id: string | null;
  raw_menu_id: string | null;
  qty: number;
  satuan: string | null;
  cost: number | null;
  sort_order: number | null;
  os_bahan_baku: { name: string; satuan_dapur: string | null; harga_per_porsi: number | null } | null;
  os_raw_menu: { name: string; satuan_hasil: string | null; cogs_per_unit: number | null } | null;
}

interface Props {
  recipes: RecipeOption[];
  selectedId: string;
  detail: RecipeDetail | null;
  items: RecipeItem[];
}

function marginAccent(pct: number | null) {
  if (pct == null) return 'text-text-muted';
  if (pct >= 60) return 'text-success';
  if (pct >= 30) return 'text-warning';
  return 'text-danger';
}

export function HppCalculator({ recipes, selectedId, detail, items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    startTransition(() => router.push(`/management/hpp?recipe=${encodeURIComponent(value)}`));
  }

  const margin =
    detail?.os_master_menu?.harga_jual && detail?.cogs_per_unit
      ? ((detail.os_master_menu.harga_jual - detail.cogs_per_unit) /
          detail.os_master_menu.harga_jual) *
        100
      : null;

  // Recompute total dari items (untuk verifikasi)
  const computedTotal = items.reduce((sum, it) => sum + Number(it.cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-teal" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Kalkulator HPP</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Hitung HPP per menu berdasarkan komposisi resep & harga bahan terkini
        </p>
      </header>

      <div className="rounded-xl bg-surface p-5 shadow-card">
        <label htmlFor="recipe-select" className="mb-2 block text-sm font-medium text-forest">
          Pilih Resep
        </label>
        <div className="flex items-center gap-3">
          <select
            id="recipe-select"
            value={selectedId}
            onChange={handleSelect}
            disabled={isPending}
            className="h-10 flex-1 rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
          >
            <option value="">— Pilih resep —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.os_master_menu?.name && r.os_master_menu.name !== r.name
                  ? ` (Menu: ${r.os_master_menu.name})`
                  : ''}
              </option>
            ))}
          </select>
          {isPending ? <Loader2 className="h-5 w-5 animate-spin text-teal" /> : null}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {recipes.length} resep tersedia · pilih untuk lihat breakdown HPP
        </p>
      </div>

      {!detail ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Harga Jual"
              value={
                detail.os_master_menu?.harga_jual != null
                  ? formatCurrency(detail.os_master_menu.harga_jual)
                  : '—'
              }
            />
            <SummaryCard
              label="Total HPP"
              value={detail.total_cogs != null ? formatCurrency(detail.total_cogs) : '—'}
              hint={`Sum items: ${formatCurrency(computedTotal)}`}
            />
            <SummaryCard
              label="HPP per Unit"
              value={detail.cogs_per_unit != null ? formatCurrency(detail.cogs_per_unit) : '—'}
              hint={`Hasil ${formatNumber(detail.jumlah_hasil ?? 1)} ${detail.satuan_hasil ?? ''}`}
            />
            <SummaryCard
              label="Margin"
              value={margin != null ? `${margin.toFixed(1)}%` : '—'}
              accent={
                margin == null
                  ? 'muted'
                  : margin >= 60
                  ? 'success'
                  : margin >= 30
                  ? 'warning'
                  : 'danger'
              }
            />
          </div>

          <div className="overflow-hidden rounded-xl bg-surface shadow-card">
            <div className="border-b border-border-default px-5 py-3">
              <h2 className="text-base font-semibold text-text-primary">
                Breakdown Komposisi · {detail.name}
              </h2>
              <p className="text-xs text-text-muted">
                {items.length} item · semua cost di-recompute saat trigger fn_recalculate_recipe_cogs
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Tipe</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-left">Satuan</th>
                    <th className="px-4 py-3 text-right">Harga/Unit</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted">
                        Resep ini belum punya item komposisi
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const isBahan = Boolean(it.bahan_id);
                      const linkedName = isBahan
                        ? it.os_bahan_baku?.name
                        : it.os_raw_menu?.name;
                      const linkedId = isBahan ? it.bahan_id : it.raw_menu_id;
                      const unitPrice = isBahan
                        ? it.os_bahan_baku?.harga_per_porsi
                        : it.os_raw_menu?.cogs_per_unit;
                      const linkedSatuan = isBahan
                        ? it.os_bahan_baku?.satuan_dapur
                        : it.os_raw_menu?.satuan_hasil;
                      const pct =
                        computedTotal > 0 && it.cost
                          ? (Number(it.cost) / computedTotal) * 100
                          : 0;
                      return (
                        <tr
                          key={it.id}
                          className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                        >
                          <td className="px-4 py-3 text-text-muted">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <Badge variant={isBahan ? 'typePackaged' : 'typeRawBulk'}>
                              {isBahan ? 'Bahan' : 'SFG'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-text-primary">{linkedName ?? '—'}</div>
                            <div className="font-mono text-[11px] text-text-muted">{linkedId}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatNumber(it.qty)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {it.satuan ?? linkedSatuan ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-text-secondary">
                            {unitPrice != null ? formatCurrency(unitPrice) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {it.cost != null ? formatCurrency(it.cost) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-text-muted">
                            {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {items.length > 0 ? (
                  <tfoot>
                    <tr className="bg-cream/30 text-sm">
                      <td colSpan={6} className="px-4 py-3 text-right font-semibold text-text-secondary">
                        TOTAL HPP
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-teal">
                        {formatCurrency(computedTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-teal">100%</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>

          {margin != null ? (
            <div className="rounded-xl bg-surface p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Insight Profitabilitas
              </h2>
              <ul className="flex flex-col gap-2 text-sm text-text-primary">
                <li>
                  Harga jual <strong>{formatCurrency(detail.os_master_menu?.harga_jual ?? 0)}</strong> · HPP
                  per unit <strong>{formatCurrency(detail.cogs_per_unit ?? 0)}</strong>
                </li>
                <li>
                  Profit per unit:{' '}
                  <strong className={marginAccent(margin)}>
                    {formatCurrency(
                      (detail.os_master_menu?.harga_jual ?? 0) - (detail.cogs_per_unit ?? 0),
                    )}
                  </strong>{' '}
                  ({margin.toFixed(1)}% margin)
                </li>
                {margin < 30 ? (
                  <li className="text-danger">
                    ⚠ Margin rendah (&lt;30%). Pertimbangkan kenaikan harga jual atau efisiensi bahan.
                  </li>
                ) : margin < 60 ? (
                  <li className="text-warning">
                    Margin sedang (30-60%). Standar industri F&amp;B cepat saji 60-70%.
                  </li>
                ) : (
                  <li className="text-success">
                    ✓ Margin sehat (&ge;60%). Pertahankan struktur biaya.
                  </li>
                )}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent = 'muted',
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'muted' | 'success' | 'warning' | 'danger';
}) {
  const accentClass =
    accent === 'success'
      ? 'text-success'
      : accent === 'warning'
      ? 'text-warning'
      : accent === 'danger'
      ? 'text-danger'
      : 'text-midnight dark:text-cream';
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-2 font-mono text-xl font-bold ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

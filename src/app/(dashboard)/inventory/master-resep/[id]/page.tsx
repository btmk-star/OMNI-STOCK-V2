import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface ItemRow {
  id: string;
  bahan_id: string | null;
  raw_menu_id: string | null;
  qty: number;
  satuan: string | null;
  cost: number | null;
  sort_order: number | null;
  os_bahan_baku: { name: string; satuan_dapur: string | null } | null;
  os_raw_menu: { name: string; satuan_hasil: string | null } | null;
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from('os_recipes')
    .select('id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,menu_id,os_master_menu(name,harga_jual)')
    .eq('id', id)
    .single<{
      id: string;
      name: string;
      satuan_hasil: string | null;
      jumlah_hasil: number | null;
      total_cogs: number | null;
      cogs_per_unit: number | null;
      menu_id: string | null;
      os_master_menu: { name: string; harga_jual: number | null } | null;
    }>();

  if (!recipe) notFound();

  const { data: items } = await supabase
    .from('os_recipe_items')
    .select(
      'id,bahan_id,raw_menu_id,qty,satuan,cost,sort_order,os_bahan_baku(name,satuan_dapur),os_raw_menu(name,satuan_hasil)',
    )
    .eq('recipe_id', id)
    .order('sort_order');

  const itemRows = (items ?? []) as unknown as ItemRow[];

  const margin =
    recipe.os_master_menu?.harga_jual && recipe.cogs_per_unit
      ? ((recipe.os_master_menu.harga_jual - recipe.cogs_per_unit) /
          recipe.os_master_menu.harga_jual) *
        100
      : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/inventory/master-resep"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-teal"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        Back ke Master Resep
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs text-teal">{recipe.id}</p>
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">{recipe.name}</h1>
        <p className="text-sm text-text-secondary">
          {recipe.os_master_menu ? `Menu: ${recipe.os_master_menu.name} · ` : ''}
          Hasil {formatNumber(recipe.jumlah_hasil ?? 0)} {recipe.satuan_hasil ?? ''} ·{' '}
          {itemRows.length} bahan komposisi
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Harga Jual"
          value={
            recipe.os_master_menu?.harga_jual != null
              ? formatCurrency(recipe.os_master_menu.harga_jual)
              : '—'
          }
        />
        <SummaryCard
          label="Total COGS"
          value={recipe.total_cogs != null ? formatCurrency(recipe.total_cogs) : '—'}
        />
        <SummaryCard
          label="COGS per Unit"
          value={recipe.cogs_per_unit != null ? formatCurrency(recipe.cogs_per_unit) : '—'}
        />
        <SummaryCard
          label="Margin"
          value={margin != null ? `${margin.toFixed(1)}%` : '—'}
          accent={
            margin == null ? 'muted' : margin >= 60 ? 'success' : margin >= 30 ? 'warning' : 'danger'
          }
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className="border-b border-border-default px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Komposisi</h2>
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
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">
                    Belum ada item komposisi
                  </td>
                </tr>
              ) : (
                itemRows.map((it, idx) => {
                  const isBahan = Boolean(it.bahan_id);
                  const linkedName = isBahan
                    ? it.os_bahan_baku?.name
                    : it.os_raw_menu?.name;
                  const linkedId = isBahan ? it.bahan_id : it.raw_menu_id;
                  const linkedSatuan = isBahan
                    ? it.os_bahan_baku?.satuan_dapur
                    : it.os_raw_menu?.satuan_hasil;
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
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(it.qty)}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {it.satuan ?? linkedSatuan ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {it.cost != null ? formatCurrency(it.cost) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = 'muted',
}: {
  label: string;
  value: string;
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
    </div>
  );
}

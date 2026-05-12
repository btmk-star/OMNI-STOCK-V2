import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface ItemRow {
  id: string;
  bahan_id: string | null;
  qty: number;
  satuan: string | null;
  cost: number | null;
  sort_order: number | null;
  os_bahan_baku: { name: string; satuan_dapur: string | null } | null;
}

export default async function RawMenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawMenu } = await supabase
    .from('os_raw_menu')
    .select('id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit')
    .eq('id', id)
    .single<{
      id: string;
      name: string;
      satuan_hasil: string | null;
      jumlah_hasil: number | null;
      total_cogs: number | null;
      cogs_per_unit: number | null;
    }>();

  if (!rawMenu) notFound();

  const { data: items } = await supabase
    .from('os_raw_menu_items')
    .select('id,bahan_id,qty,satuan,cost,sort_order,os_bahan_baku(name,satuan_dapur)')
    .eq('raw_menu_id', id)
    .order('sort_order');

  const itemRows = (items ?? []) as unknown as ItemRow[];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/inventory/raw-menu"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-teal"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        Back ke Raw Menu
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs text-teal">{rawMenu.id}</p>
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">{rawMenu.name}</h1>
        <p className="text-sm text-text-secondary">
          Hasil: {formatNumber(rawMenu.jumlah_hasil ?? 0)} {rawMenu.satuan_hasil ?? ''} ·{' '}
          {itemRows.length} bahan komposisi
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total COGS"
          value={rawMenu.total_cogs != null ? formatCurrency(rawMenu.total_cogs) : '—'}
        />
        <SummaryCard
          label="COGS per Unit"
          value={rawMenu.cogs_per_unit != null ? formatCurrency(rawMenu.cogs_per_unit) : '—'}
        />
        <SummaryCard
          label="Hasil Produksi"
          value={`${formatNumber(rawMenu.jumlah_hasil ?? 0)} ${rawMenu.satuan_hasil ?? ''}`}
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className="border-b border-border-default px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Komposisi Bahan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Bahan</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Satuan</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">
                    Belum ada item komposisi
                  </td>
                </tr>
              ) : (
                itemRows.map((it, idx) => (
                  <tr
                    key={it.id}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3 text-text-muted">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-text-primary">{it.os_bahan_baku?.name ?? '—'}</div>
                      <div className="font-mono text-[11px] text-text-muted">{it.bahan_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(it.qty)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {it.satuan ?? it.os_bahan_baku?.satuan_dapur ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {it.cost != null ? formatCurrency(it.cost) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 font-mono text-xl font-bold text-midnight dark:text-cream">{value}</p>
    </div>
  );
}

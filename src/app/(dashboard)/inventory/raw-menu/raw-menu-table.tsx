'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

export interface RawMenuRow {
  id: string;
  name: string;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  total_cogs: number | null;
  cogs_per_unit: number | null;
  is_active: boolean;
  updated_at: string | null;
}

interface Props {
  initial: RawMenuRow[];
  total: number;
  query: string;
  fetchError: string | null;
}

export function RawMenuTable({ initial, total, query, fetchError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('q', search);
    else params.delete('q');
    startTransition(() => router.push(`/inventory/raw-menu?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">Raw Menu</h1>
        <p className="text-sm text-text-secondary">
          {total} semi-finished goods · komposisi bahan dengan COGS
        </p>
      </header>

      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {fetchError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <form
          onSubmit={handleSearch}
          className="flex gap-3 border-b border-border-default bg-surface-alt px-5 py-3"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              strokeWidth={1.5}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama SFG..."
              className="pl-9"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cari
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Nama SFG</th>
                <th className="px-4 py-3 text-left">Satuan Hasil</th>
                <th className="px-4 py-3 text-right">Jumlah Hasil</th>
                <th className="px-4 py-3 text-right">Total COGS</th>
                <th className="px-4 py-3 text-right">COGS/Unit</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {initial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      {query ? 'Tidak ada hasil pencarian' : 'Belum ada SFG'}
                    </p>
                  </td>
                </tr>
              ) : (
                initial.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border-default/50 text-sm hover:bg-mint/30"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-teal">{r.id}</td>
                    <td className="px-4 py-3 text-text-primary">{r.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.satuan_hasil ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.jumlah_hasil != null ? formatNumber(r.jumlah_hasil) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.total_cogs != null ? formatCurrency(r.total_cogs) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {r.cogs_per_unit != null ? formatCurrency(r.cogs_per_unit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/raw-menu/${encodeURIComponent(r.id)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        Detail
                        <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
                      </Link>
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

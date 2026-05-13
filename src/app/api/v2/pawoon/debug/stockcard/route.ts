import { NextRequest, NextResponse } from 'next/server';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { daysAgoInJakarta, todayInJakarta } from '@/lib/pawoon/transforms';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonStockCardRow,
} from '@/lib/pawoon/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const outletIdParam = url.searchParams.get('outlet_id');
  const dateParam = url.searchParams.get('date');
  const datesParam = url.searchParams.get('dates'); // optional: comma-separated YYYY-MM-DD
  const allOutlets = url.searchParams.get('all') === '1';

  try {
    // Resolve outlet list
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);

    if (activeOutlets.length === 0) {
      return NextResponse.json({
        ok: true,
        warning: 'No active outlets returned from Pawoon /outlets',
        outlets_response: outletsResp,
      });
    }

    const outletsToProbe = outletIdParam
      ? activeOutlets.filter((o) => o.id === outletIdParam)
      : allOutlets
        ? activeOutlets
        : [activeOutlets[0]];

    const datesToProbe = datesParam
      ? datesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [
          dateParam ?? daysAgoInJakarta(1),
          daysAgoInJakarta(2),
          daysAgoInJakarta(3),
          todayInJakarta(),
        ];

    const probes: Array<{
      outlet_id: string;
      outlet_name: string;
      date: string;
      record_count: number;
      sample: PawoonStockCardRow | null;
      meta: PawoonPaginatedResponse<PawoonStockCardRow>['meta'];
      raw_keys: string[];
    }> = [];

    for (const outlet of outletsToProbe) {
      for (const date of datesToProbe) {
        const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonStockCardRow>>(
          PAWOON_PATHS.inventoryStockCard,
          { query: { outlet_id: outlet.id, date } },
        );
        const records = resp.data ?? [];
        const sample = records[0] ?? null;
        probes.push({
          outlet_id: outlet.id,
          outlet_name: outlet.name,
          date,
          record_count: records.length,
          sample,
          meta: resp.meta,
          raw_keys: sample ? Object.keys(sample) : [],
        });
      }
    }

    return NextResponse.json({
      ok: true,
      probed_outlets: outletsToProbe.length,
      probed_dates: datesToProbe,
      total_outlets_available: activeOutlets.length,
      probes,
      hint: probes.every((p) => p.record_count === 0)
        ? 'Semua probe return 0 records. Kemungkinan: (1) outlet tidak punya stock tracking enabled di Pawoon backend, (2) belum ada penjualan yang men-trigger stock movement, (3) endpoint butuh param tambahan yang belum kita kirim.'
        : 'Beberapa probe return data. Pakai shape sample untuk verify transforms.',
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      { status: 500 },
    );
  }
}

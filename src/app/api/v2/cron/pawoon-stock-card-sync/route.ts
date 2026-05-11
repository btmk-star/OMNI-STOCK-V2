import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { pawoonStockCardToRow, todayInJakarta } from '@/lib/pawoon/transforms';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonStockCardRow,
} from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-03] Pawoon Stock Card Sync';
const BATCH_SIZE = 500;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  const periodDate = todayInJakarta();
  let totalSynced = 0;
  const perOutletStats: Array<{ outlet_id: string; rows: number }> = [];

  try {
    // Pull list outlet active dari Pawoon (source of truth — kalau outlet baru ditambah,
    // langsung ke-include tanpa nunggu cron product sync)
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);

    for (const outlet of activeOutlets) {
      const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonStockCardRow>>(
        PAWOON_PATHS.inventoryStockCard,
        { query: { outlet_id: outlet.id, date: periodDate } },
      );

      const items = (resp.data ?? []).map((row) =>
        pawoonStockCardToRow(row, outlet.id, periodDate),
      );

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('pawoon_stock_cards')
          .upsert(batch as never, {
            onConflict: 'pawoon_outlet_id,pawoon_product_id,period_date',
          });
        if (error) {
          throw new Error(`pawoon_stock_cards upsert outlet ${outlet.id}: ${error.message}`);
        }
        totalSynced += batch.length;
      }

      perOutletStats.push({ outlet_id: outlet.id, rows: items.length });
    }

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_stock_cards',
      records_synced: totalSynced,
      duration_ms: elapsed(),
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return Response.json({
      success: true,
      period_date: periodDate,
      outlets_synced: activeOutlets.length,
      records_synced: totalSynced,
      per_outlet: perOutletStats,
      duration_ms: elapsed(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WF-03] STOCK_CARD_SYNC_FAILED', error);

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_stock_cards',
      records_synced: totalSynced,
      duration_ms: elapsed(),
      status: 'failed',
      error,
      synced_at: new Date().toISOString(),
    } as never);

    return Response.json(
      { success: false, error, records_synced: totalSynced },
      { status: 500 },
    );
  }
}

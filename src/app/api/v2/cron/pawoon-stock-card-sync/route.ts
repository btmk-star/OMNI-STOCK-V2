import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { pawoonStockCardToRow, todayInJakarta } from '@/lib/pawoon/transforms';
import type { PawoonPaginatedResponse, PawoonStockCardRow } from '@/lib/pawoon/types';
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

  try {
    // Per Pawoon API: GET /inventory/stockcard returns rows for all outlets/products on given date
    const response = await fetchPawoon<PawoonPaginatedResponse<PawoonStockCardRow>>(
      PAWOON_PATHS.inventoryStockCard,
      { query: { date: periodDate } },
    );

    const items = (response.data ?? []).map((row) => pawoonStockCardToRow(row, periodDate));

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('pawoon_stock_cards')
        .upsert(batch as never, {
          onConflict: 'pawoon_outlet_id,pawoon_product_id,period_date',
        });
      if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
      totalSynced += batch.length;
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
      records_synced: totalSynced,
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

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_DEFAULT_PER_PAGE, PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { pawoonTransactionToRow } from '@/lib/pawoon/transforms';
import type { PawoonPaginatedResponse, PawoonTransaction } from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-02] Pawoon Transaction Sync';
const BATCH_SIZE = 500;

// Catch-up window kalau workflow gagal beberapa kali — fetch transaksi 24 jam terakhir
// kalau tidak ada last_synced_at di pawoon_sync_log.
const FALLBACK_LOOKBACK_HOURS = 24;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  let totalSynced = 0;

  try {
    // Cari last successful sync — pakai itu sebagai cursor "since".
    const { data: lastLog } = await supabase
      .from('pawoon_sync_log')
      .select('synced_at')
      .eq('workflow', WORKFLOW)
      .eq('status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single<{ synced_at: string }>();

    const since =
      lastLog?.synced_at ??
      new Date(Date.now() - FALLBACK_LOOKBACK_HOURS * 3600 * 1000).toISOString();

    let page = 1;
    let lastPage = 1;

    do {
      const response = await fetchPawoon<PawoonPaginatedResponse<PawoonTransaction>>(
        PAWOON_PATHS.transactions,
        { query: { since, page, per_page: PAWOON_DEFAULT_PER_PAGE } },
      );

      const items = (response.data ?? []).map(pawoonTransactionToRow);
      lastPage = response.meta?.last_page ?? response.meta?.total_pages ?? page;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('pawoon_transactions')
          .upsert(batch as never, { onConflict: 'pawoon_id' });
        if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
        totalSynced += batch.length;
      }

      page += 1;
    } while (page <= lastPage);

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_transactions',
      records_synced: totalSynced,
      duration_ms: elapsed(),
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return Response.json({
      success: true,
      since,
      records_synced: totalSynced,
      duration_ms: elapsed(),
      pages: lastPage,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WF-02] TRANSACTION_SYNC_FAILED', error);

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_transactions',
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

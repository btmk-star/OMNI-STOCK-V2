import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_DEFAULT_PER_PAGE, PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { pawoonTotalPages, pawoonTransactionToRow } from '@/lib/pawoon/transforms';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonTransaction,
} from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-02] Pawoon Transaction Sync';
const BATCH_SIZE = 500;
const FALLBACK_LOOKBACK_HOURS = 24;
// Vercel Hobby plan punya 60s execution limit — batasi total pages per run
// supaya tidak timeout. Cron 5 menit interval otomatis pick up sisa di run berikut.
const MAX_PAGES_PER_OUTLET = 5;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  let totalSynced = 0;

  try {
    // Cursor: ambil last successful sync time dari log
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

    // Fetch outlets list dulu
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);

    for (const outlet of activeOutlets) {
      let page = 1;
      let totalPages = 1;
      do {
        const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonTransaction>>(
          PAWOON_PATHS.transactions,
          {
            query: {
              outlet_id: outlet.id,
              since,
              page,
              per_page: PAWOON_DEFAULT_PER_PAGE,
            },
          },
        );
        totalPages = pawoonTotalPages(resp.meta);

        const items = (resp.data ?? []).map(pawoonTransactionToRow);
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from('pawoon_transactions')
            .upsert(batch as never, { onConflict: 'pawoon_id' });
          if (error) {
            throw new Error(`pawoon_transactions upsert outlet ${outlet.id}: ${error.message}`);
          }
          totalSynced += batch.length;
        }
        page += 1;
      } while (page <= totalPages && page <= MAX_PAGES_PER_OUTLET);
    }

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
      outlets_synced: activeOutlets.length,
      records_synced: totalSynced,
      duration_ms: elapsed(),
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

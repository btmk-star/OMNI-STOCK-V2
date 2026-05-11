import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_DEFAULT_PER_PAGE, PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import { pawoonProductToRow } from '@/lib/pawoon/transforms';
import type { PawoonPaginatedResponse, PawoonProduct } from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-01] Pawoon Product Sync';
const BATCH_SIZE = 500;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  let totalSynced = 0;
  let page = 1;
  let lastPage = 1;
  let lastError: string | null = null;

  try {
    do {
      const response = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
        PAWOON_PATHS.products,
        { query: { page, per_page: PAWOON_DEFAULT_PER_PAGE } },
      );

      const items = (response.data ?? []).map(pawoonProductToRow);
      lastPage = response.meta?.last_page ?? response.meta?.total_pages ?? page;

      // Batch upsert (Supabase max 500/call per Quality Rules §C6)
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('pawoon_products')
          .upsert(batch as never, { onConflict: 'pawoon_id' });
        if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
        totalSynced += batch.length;
      }

      page += 1;
    } while (page <= lastPage);

    await logSync(supabase, {
      records_synced: totalSynced,
      duration_ms: elapsed(),
      status: 'success',
    });

    return Response.json({
      success: true,
      records_synced: totalSynced,
      duration_ms: elapsed(),
      pages: lastPage,
    });
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error('[WF-01] PRODUCT_SYNC_FAILED', lastError);

    await logSync(supabase, {
      records_synced: totalSynced,
      duration_ms: elapsed(),
      status: 'failed',
      error: lastError,
    });

    return Response.json(
      { success: false, error: lastError, records_synced: totalSynced },
      { status: 500 },
    );
  }
}

async function logSync(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    records_synced: number;
    duration_ms: number;
    status: 'success' | 'partial' | 'failed';
    error?: string | null;
  },
) {
  await supabase
    .from('pawoon_sync_log')
    .insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_products',
      ...data,
      synced_at: new Date().toISOString(),
    } as never);
}

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from './client';
import { PAWOON_DEFAULT_PER_PAGE, PAWOON_PATHS } from './endpoints';
import {
  daysAgoInJakarta,
  pawoonOutletToRow,
  pawoonProductToRow,
  pawoonStockCardToRow,
  pawoonTotalPages,
  pawoonTransactionToRow,
  type PawoonProductRow,
} from './transforms';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonProduct,
  PawoonStockCardRow,
  PawoonTransaction,
} from './types';

export const WORKFLOW_LABELS = {
  product: '[WF-01] Pawoon Product Sync',
  stockCard: '[WF-03] Pawoon Stock Card Sync',
  transaction: '[WF-02] Pawoon Transaction Sync',
} as const;

export interface SyncResult {
  success: boolean;
  records_synced: number;
  duration_ms: number;
  error?: string;
  details?: Record<string, unknown>;
}

const BATCH_SIZE = 500;
const PRODUCT_PAGE_SIZE = 100;
const TRANSACTION_MAX_PAGES_PER_OUTLET = 5;
const TRANSACTION_FALLBACK_LOOKBACK_HOURS = 24;
// Pawoon /inventory/stockcard return end-of-day snapshot — query today selalu 0.
// Backfill H-1 sampai H-3 supaya user bisa scroll date picker beberapa hari ke belakang.
const STOCK_CARD_DAYS_BACK = 3;

function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}

export async function runProductSync(): Promise<SyncResult> {
  const elapsed = timer();
  const supabase = createAdminClient();
  let totalProductsSynced = 0;
  let outletsSynced = 0;

  try {
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);
    const outletRows = activeOutlets.map(pawoonOutletToRow);

    if (outletRows.length > 0) {
      const { error } = await supabase
        .from('pawoon_outlets')
        .upsert(outletRows as never, { onConflict: 'pawoon_id' });
      if (error) throw new Error(`pawoon_outlets upsert: ${error.message}`);
      outletsSynced = outletRows.length;
    }

    const productsByOutlet = await Promise.all(
      activeOutlets.map(async (outlet) => {
        const outletProducts: PawoonProductRow[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
            PAWOON_PATHS.products,
            { query: { outlet_id: outlet.id, page, per_page: PRODUCT_PAGE_SIZE } },
          );
          totalPages = pawoonTotalPages(resp.meta);
          for (const p of resp.data ?? []) {
            outletProducts.push(pawoonProductToRow(p, outlet.id));
          }
          page += 1;
        } while (page <= totalPages);
        return { outletId: outlet.id, products: outletProducts };
      }),
    );

    const productByPawoonId = new Map<string, PawoonProductRow>();
    for (const { products } of productsByOutlet) {
      for (const row of products) {
        const existing = productByPawoonId.get(row.pawoon_id);
        if (existing) {
          existing.outlet_ids = [...new Set([...existing.outlet_ids, ...row.outlet_ids])];
        } else {
          productByPawoonId.set(row.pawoon_id, row);
        }
      }
    }

    const allProducts = [...productByPawoonId.values()];
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('pawoon_products')
        .upsert(batch as never, { onConflict: 'pawoon_id' });
      if (error) throw new Error(`pawoon_products upsert (batch ${i}): ${error.message}`);
      totalProductsSynced += batch.length;
    }

    const duration_ms = elapsed();
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.product,
      table_name: 'pawoon_products',
      records_synced: totalProductsSynced,
      duration_ms,
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return {
      success: true,
      records_synced: totalProductsSynced,
      duration_ms,
      details: { outlets_synced: outletsSynced },
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const duration_ms = elapsed();
    console.error('[WF-01] PRODUCT_SYNC_FAILED', errMsg);
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.product,
      table_name: 'pawoon_products',
      records_synced: totalProductsSynced,
      duration_ms,
      status: 'failed',
      error: errMsg,
      synced_at: new Date().toISOString(),
    } as never);
    return {
      success: false,
      records_synced: totalProductsSynced,
      duration_ms,
      error: errMsg,
    };
  }
}

export async function runStockCardSync(): Promise<SyncResult> {
  const elapsed = timer();
  const supabase = createAdminClient();
  // Pawoon return end-of-day snapshot — pakai H-1 sebagai default, tambah backfill ke H-2/H-3.
  const datesToSync = Array.from({ length: STOCK_CARD_DAYS_BACK }, (_, i) =>
    daysAgoInJakarta(i + 1),
  );
  let totalSynced = 0;
  const perDateStats: Array<{ date: string; rows: number }> = [];

  try {
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);

    for (const periodDate of datesToSync) {
      let rowsForDate = 0;
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
            throw new Error(
              `pawoon_stock_cards upsert outlet ${outlet.id} date ${periodDate}: ${error.message}`,
            );
          }
          totalSynced += batch.length;
          rowsForDate += batch.length;
        }
      }
      perDateStats.push({ date: periodDate, rows: rowsForDate });
    }

    const duration_ms = elapsed();
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.stockCard,
      table_name: 'pawoon_stock_cards',
      records_synced: totalSynced,
      duration_ms,
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return {
      success: true,
      records_synced: totalSynced,
      duration_ms,
      details: { dates_synced: datesToSync, per_date: perDateStats },
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const duration_ms = elapsed();
    console.error('[WF-03] STOCK_CARD_SYNC_FAILED', errMsg);
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.stockCard,
      table_name: 'pawoon_stock_cards',
      records_synced: totalSynced,
      duration_ms,
      status: 'failed',
      error: errMsg,
      synced_at: new Date().toISOString(),
    } as never);
    return {
      success: false,
      records_synced: totalSynced,
      duration_ms,
      error: errMsg,
    };
  }
}

export async function runTransactionSync(): Promise<SyncResult> {
  const elapsed = timer();
  const supabase = createAdminClient();
  let totalSynced = 0;

  try {
    const { data: lastLog } = await supabase
      .from('pawoon_sync_log')
      .select('synced_at')
      .eq('workflow', WORKFLOW_LABELS.transaction)
      .eq('status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single<{ synced_at: string }>();

    const since =
      lastLog?.synced_at ??
      new Date(Date.now() - TRANSACTION_FALLBACK_LOOKBACK_HOURS * 3600 * 1000).toISOString();

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
      } while (page <= totalPages && page <= TRANSACTION_MAX_PAGES_PER_OUTLET);
    }

    const duration_ms = elapsed();
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.transaction,
      table_name: 'pawoon_transactions',
      records_synced: totalSynced,
      duration_ms,
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return {
      success: true,
      records_synced: totalSynced,
      duration_ms,
      details: { since, outlets_synced: activeOutlets.length },
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const duration_ms = elapsed();
    console.error('[WF-02] TRANSACTION_SYNC_FAILED', errMsg);
    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW_LABELS.transaction,
      table_name: 'pawoon_transactions',
      records_synced: totalSynced,
      duration_ms,
      status: 'failed',
      error: errMsg,
      synced_at: new Date().toISOString(),
    } as never);
    return {
      success: false,
      records_synced: totalSynced,
      duration_ms,
      error: errMsg,
    };
  }
}

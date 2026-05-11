import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_DEFAULT_PER_PAGE, PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import {
  pawoonOutletToRow,
  pawoonProductToRow,
  pawoonTotalPages,
  type PawoonProductRow,
} from '@/lib/pawoon/transforms';
import type {
  PawoonCategory,
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonProduct,
} from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-01] Pawoon Product Sync';
const BATCH_SIZE = 500;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  let totalProductsSynced = 0;
  let outletsSynced = 0;

  try {
    // 1. Sync outlets dulu (idempotent — cuma ~5-10 outlet)
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

    // 2. Per outlet: fetch categories (untuk enrich product) + fetch products paginated
    const productByPawoonId = new Map<string, PawoonProductRow>();

    for (const outlet of activeOutlets) {
      // Categories per outlet untuk enrich category_name
      const categoryNameById = new Map<string, string>();
      try {
        const catResp = await fetchPawoon<PawoonPaginatedResponse<PawoonCategory>>(
          PAWOON_PATHS.productCategories,
          { query: { outlet_id: outlet.id } },
        );
        for (const c of catResp.data ?? []) categoryNameById.set(c.id, c.name);
      } catch {
        // Categories optional — kalau gagal, tetap lanjut sync products tanpa nama category
      }

      // Products paginated
      let page = 1;
      let totalPages = 1;
      do {
        const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
          PAWOON_PATHS.products,
          { query: { outlet_id: outlet.id, page, per_page: PAWOON_DEFAULT_PER_PAGE } },
        );
        totalPages = pawoonTotalPages(resp.meta);

        for (const p of resp.data ?? []) {
          const row = pawoonProductToRow(p, outlet.id, categoryNameById);
          // Gabung outlet_ids kalau produk yang sama (pawoon_id) muncul di beberapa outlet
          const existing = productByPawoonId.get(row.pawoon_id);
          if (existing) {
            const merged = new Set([...existing.outlet_ids, ...row.outlet_ids]);
            row.outlet_ids = [...merged];
          }
          productByPawoonId.set(row.pawoon_id, row);
        }

        page += 1;
      } while (page <= totalPages);
    }

    // 3. Batch upsert ke pawoon_products
    const allProducts = [...productByPawoonId.values()];
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('pawoon_products')
        .upsert(batch as never, { onConflict: 'pawoon_id' });
      if (error) throw new Error(`pawoon_products upsert (batch ${i}): ${error.message}`);
      totalProductsSynced += batch.length;
    }

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_products',
      records_synced: totalProductsSynced,
      duration_ms: elapsed(),
      status: 'success',
      synced_at: new Date().toISOString(),
    } as never);

    return Response.json({
      success: true,
      outlets_synced: outletsSynced,
      products_synced: totalProductsSynced,
      duration_ms: elapsed(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WF-01] PRODUCT_SYNC_FAILED', error);

    await supabase.from('pawoon_sync_log').insert({
      workflow: WORKFLOW,
      table_name: 'pawoon_products',
      records_synced: totalProductsSynced,
      duration_ms: elapsed(),
      status: 'failed',
      error,
      synced_at: new Date().toISOString(),
    } as never);

    return Response.json(
      { success: false, error, products_synced: totalProductsSynced },
      { status: 500 },
    );
  }
}

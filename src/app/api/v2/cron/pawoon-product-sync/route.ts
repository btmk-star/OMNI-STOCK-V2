import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import {
  pawoonOutletToRow,
  pawoonProductToRow,
  pawoonTotalPages,
  type PawoonProductRow,
} from '@/lib/pawoon/transforms';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonProduct,
} from '@/lib/pawoon/types';
import { startTimer, unauthorizedResponse, verifyCronAuth } from '../_helpers';

const WORKFLOW = '[WF-01] Pawoon Product Sync';
const BATCH_SIZE = 500;
// Pawoon kasih default 100/page. Naikkan ke 200 untuk kurangi pagination calls,
// jadi total runtime turun ~half. Tetap aman per Pawoon limits.
const PAGE_SIZE = 200;

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby max — strict.

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const elapsed = startTimer();
  const supabase = createAdminClient();
  let totalProductsSynced = 0;
  let outletsSynced = 0;

  try {
    // 1. Sync outlets dulu (cheap, ~1 call)
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

    // 2. Per outlet PARALLEL: fetch all pages of products. Pawoon catalog di-share
    // antar outlet jadi total unique products tetap sama, tapi kita perlu fetch per
    // outlet untuk dapat outlet_ids array yang lengkap.
    // Skip categories enrich di sini supaya cepat — bisa di-backfill via separate cron.
    const productsByOutlet = await Promise.all(
      activeOutlets.map(async (outlet) => {
        const outletProducts: PawoonProductRow[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const resp = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
            PAWOON_PATHS.products,
            { query: { outlet_id: outlet.id, page, per_page: PAGE_SIZE } },
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

    // 3. Merge: kalau pawoon_id sama muncul di multiple outlet, gabung outlet_ids
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

    // 4. Batch upsert ke pawoon_products
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

import { NextRequest } from 'next/server';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import type {
  PawoonOutlet,
  PawoonPaginatedResponse,
  PawoonProduct,
} from '@/lib/pawoon/types';
import { unauthorizedResponse, verifyCronAuth } from '../../cron/_helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  try {
    // 1. Probe outlets
    const outletsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonOutlet>>(
      PAWOON_PATHS.outlets,
      { noRetry: true },
    );
    const activeOutlets = (outletsResp.data ?? []).filter((o) => !o.deleted_at);

    if (activeOutlets.length === 0) {
      return Response.json({
        success: true,
        outlets_count: 0,
        sample_product: null,
        note: 'No active outlets',
      });
    }

    // 2. Sample 1 product dari outlet pertama
    const firstOutlet = activeOutlets[0];
    const productsResp = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
      PAWOON_PATHS.products,
      { query: { outlet_id: firstOutlet.id, page: 1, per_page: 1 }, noRetry: true },
    );

    const sample = productsResp.data?.[0];
    return Response.json({
      success: true,
      base_url: process.env.PAWOON_API_BASE_URL ?? 'https://open-api.pawoon.com',
      outlets_count: activeOutlets.length,
      outlets: activeOutlets.map((o) => ({ id: o.id, name: o.name })),
      first_outlet_products_total: productsResp.meta?.total ?? null,
      sample_product: sample
        ? {
            id: sample.id,
            name: sample.name,
            price: sample.price,
            sku: sample.sku,
            sellable: sample.sellable,
          }
        : null,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error }, { status: 502 });
  }
}

import { NextRequest } from 'next/server';
import { fetchPawoon } from '@/lib/pawoon/client';
import { PAWOON_PATHS } from '@/lib/pawoon/endpoints';
import type { PawoonPaginatedResponse, PawoonProduct } from '@/lib/pawoon/types';
import { unauthorizedResponse, verifyCronAuth } from '../../cron/_helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  try {
    const response = await fetchPawoon<PawoonPaginatedResponse<PawoonProduct>>(
      PAWOON_PATHS.products,
      { query: { page: 1, per_page: 1 }, noRetry: true },
    );

    const sample = response.data?.[0];
    return Response.json({
      success: true,
      base_url: process.env.PAWOON_API_BASE_URL ?? 'https://open-api.pawoon.com',
      sample_product: sample
        ? { id: sample.id, name: sample.name, category_name: sample.category_name }
        : null,
      total_pages: response.meta?.last_page ?? response.meta?.total_pages ?? null,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error }, { status: 502 });
  }
}

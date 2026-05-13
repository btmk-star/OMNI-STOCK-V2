import { NextRequest } from 'next/server';
import { runStockCardSync } from '@/lib/pawoon/sync-runners';
import { unauthorizedResponse, verifyCronAuth } from '../_helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();
  const result = await runStockCardSync();
  return Response.json(result, { status: result.success ? 200 : 500 });
}

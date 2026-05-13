'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import {
  daysAgoJakarta,
  groupByDay,
  groupBySession,
  jakartaDateKey,
  startOfDayJakarta,
  topMenuByQty,
  type TrxLike,
} from '@/lib/utils/dashboard-aggregate';
import {
  generateSalesPrediction,
  type PredictionResult,
} from '@/lib/claude/predictions';
import { CLAUDE_MODEL } from '@/lib/claude/client';

type ActionResult<T = unknown> =
  | { data: T; error?: never; cached?: boolean }
  | { error: string; data?: never };

const CACHE_TTL_HOURS = 24;
const PREDICTION_TYPE = 'sales_forecast_7d';
const TRX_FETCH_LIMIT = 5000;

interface CachedPredictionRow {
  id: string;
  prediction: PredictionResult;
  created_at: string;
  expires_at: string | null;
}

export async function generatePrediction(opts?: {
  force?: boolean;
}): Promise<ActionResult<PredictionResult & { cached: boolean; createdAt: string }>> {
  const supabase = await createClient();

  // 1. RBAC
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Tidak terautentikasi' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single<{ role: Role }>();

  if (!hasPermission(profile?.role ?? null, 'ai.predictions')) {
    return { error: 'Role kamu tidak punya akses ke AI predictions' };
  }

  // 2. Cek cache (kalau bukan force refresh)
  if (!opts?.force) {
    const { data: cached } = await supabase
      .from('os_ai_predictions')
      .select('id,prediction,created_at,expires_at')
      .eq('prediction_type', PREDICTION_TYPE)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<CachedPredictionRow>();

    if (cached?.prediction) {
      return {
        data: { ...cached.prediction, cached: true, createdAt: cached.created_at },
      };
    }
  }

  // 3. Fetch transaksi 30 hari + 7 hari (anchor strategy sama dengan dashboard)
  const { data: latestRow } = await supabase
    .from('pawoon_transactions')
    .select('transaction_date')
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single<{ transaction_date: string }>();

  if (!latestRow) {
    return { error: 'Belum ada data transaksi untuk diprediksi' };
  }

  const anchor = new Date(latestRow.transaction_date);
  const anchorStart = startOfDayJakarta(anchor);
  const anchorKey = jakartaDateKey(anchorStart);
  const day30Start = daysAgoJakarta(anchor, 30);
  const day7Start = daysAgoJakarta(anchor, 7);

  const { data: trxRaw } = await supabase
    .from('pawoon_transactions')
    .select('transaction_date,total_amount,session,channel,items,pawoon_outlet_id')
    .gte('transaction_date', day30Start.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(TRX_FETCH_LIMIT);

  const trxs = (trxRaw ?? []) as unknown as TrxLike[];
  if (trxs.length === 0) {
    return { error: 'Tidak ada transaksi di window 30 hari' };
  }

  const trx7 = trxs.filter((t) => new Date(t.transaction_date) >= day7Start);
  const dailySeries = groupByDay(trxs);
  const sessionSeries = groupBySession(trxs);
  const topMenu = topMenuByQty(trx7, 5);

  // 4. Call Claude
  let result: PredictionResult;
  try {
    result = await generateSalesPrediction({
      anchorDate: anchorKey,
      outletScope: 'all',
      dailySeries,
      sessionSeries,
      topMenu,
    });
  } catch (err) {
    return {
      error: `Gagal generate prediksi: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }

  // 5. Cache di os_ai_predictions
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from('os_ai_predictions')
    .insert({
      prediction_type: PREDICTION_TYPE,
      outlet_id: null,
      target_date: anchorKey,
      input_data: { anchorDate: anchorKey, dailyCount: dailySeries.length, topMenuCount: topMenu.length },
      prediction: result,
      confidence: null,
      model_version: CLAUDE_MODEL,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      expires_at: expiresAt,
    })
    .select('created_at')
    .single<{ created_at: string }>();

  const createdAt = inserted?.created_at ?? new Date().toISOString();
  if (insertErr) {
    console.error('[claude.actions] insert prediction failed:', insertErr);
  }

  revalidatePath('/');
  return { data: { ...result, cached: false, createdAt } };
}

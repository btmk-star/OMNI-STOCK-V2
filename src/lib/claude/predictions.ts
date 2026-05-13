import { CLAUDE_MODEL, getClaudeClient } from './client';
import type { DayPoint, SessionPoint, TopMenuPoint } from '@/lib/utils/dashboard-aggregate';

export interface PredictionInput {
  anchorDate: string; // YYYY-MM-DD (anchor terakhir data tersedia)
  outletScope: string; // 'all' atau outlet name
  dailySeries: DayPoint[]; // 30 hari
  sessionSeries: SessionPoint[];
  topMenu: TopMenuPoint[];
}

export interface PredictionForecastDay {
  date: string; // YYYY-MM-DD
  predicted_revenue: number;
  predicted_trx: number;
  notes: string;
}

export interface ReorderSuggestion {
  product_name: string;
  reason: string;
  suggested_action: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface PredictionResult {
  summary: string;
  trend_analysis: string;
  forecast_7days: PredictionForecastDay[];
  reorder_suggestions: ReorderSuggestion[];
  risk_alerts: string[];
  generated_at: string; // ISO timestamp
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const SYSTEM_PROMPT = `Anda adalah analis data F&B senior untuk EGG Group, restoran mie di Indonesia.
Tugas: analisis pola sales 30 hari + top menu + session breakdown, hasilkan prediksi 7 hari ke depan + reorder suggestions yang actionable.

Output WAJIB JSON valid (tidak ada teks tambahan, tidak ada markdown), struktur:
{
  "summary": "1-2 kalimat ringkasan pola utama (Bahasa Indonesia)",
  "trend_analysis": "2-3 kalimat analisis tren (naik/turun/stabil) dengan angka kongkret",
  "forecast_7days": [
    { "date": "YYYY-MM-DD", "predicted_revenue": number, "predicted_trx": number, "notes": "alasan" }
  ],
  "reorder_suggestions": [
    { "product_name": "nama menu/bahan", "reason": "kenapa", "suggested_action": "apa yang harus dilakukan", "urgency": "low|medium|high" }
  ],
  "risk_alerts": ["risiko/anomali yang perlu diperhatikan"]
}

Aturan:
- forecast_7days HARUS 7 entries berurutan dimulai dari (anchorDate + 1 hari).
- predicted_revenue dalam rupiah (integer).
- reorder_suggestions max 5 item, fokus ke top menu yang trending naik atau yang biasanya stockout.
- risk_alerts max 3 (cuaca, weekend dip, hari libur Indonesia, anomali pattern).
- Bahasa Indonesia natural, hindari jargon teknis.`;

function buildUserPrompt(input: PredictionInput): string {
  const lastWeek = input.dailySeries.slice(-7);
  const prevWeek = input.dailySeries.slice(-14, -7);
  const lastWeekRevenue = lastWeek.reduce((s, d) => s + d.revenue, 0);
  const prevWeekRevenue = prevWeek.reduce((s, d) => s + d.revenue, 0);
  const wow =
    prevWeekRevenue > 0
      ? (((lastWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100).toFixed(1)
      : 'N/A';

  return `Anchor date: ${input.anchorDate}
Outlet scope: ${input.outletScope}

== Daily Sales 30 Hari (date | revenue | trx) ==
${input.dailySeries.map((d) => `${d.date} | ${d.revenue} | ${d.trxCount}`).join('\n')}

== Week-over-Week ==
Minggu ini (last 7 days): Rp ${lastWeekRevenue.toLocaleString('id-ID')}
Minggu lalu: Rp ${prevWeekRevenue.toLocaleString('id-ID')}
WoW change: ${wow}%

== Session Breakdown 30 Hari ==
${input.sessionSeries.map((s) => `${s.label}: ${s.trxCount} trx, Rp ${s.revenue.toLocaleString('id-ID')}`).join('\n')}

== Top 5 Menu 7 Hari (qty terjual) ==
${input.topMenu.length === 0 ? '(belum ada items detail di transaksi)' : input.topMenu.map((m, i) => `${i + 1}. ${m.productName}: ${m.qty} pcs, Rp ${m.revenue.toLocaleString('id-ID')}`).join('\n')}

Generate prediksi 7 hari ke depan + reorder suggestions. Return JSON only.`;
}

export async function generateSalesPrediction(input: PredictionInput): Promise<PredictionResult> {
  const client = getClaudeClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });

  const textBlock = message.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response tidak berisi text block');
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');

  let parsed: Omit<PredictionResult, 'generated_at' | 'model' | 'input_tokens' | 'output_tokens'>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Claude response bukan JSON valid: ${err instanceof Error ? err.message : 'parse error'}`,
    );
  }

  return {
    ...parsed,
    generated_at: new Date().toISOString(),
    model: CLAUDE_MODEL,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
  };
}

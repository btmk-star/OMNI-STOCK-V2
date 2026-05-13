'use client';

import { useState, useTransition } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePrediction } from '@/lib/actions/claude.actions';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import type {
  PredictionForecastDay,
  ReorderSuggestion,
} from '@/lib/claude/predictions';

interface DisplayResult {
  summary: string;
  trend_analysis: string;
  forecast_7days: PredictionForecastDay[];
  reorder_suggestions: ReorderSuggestion[];
  risk_alerts: string[];
  generated_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached: boolean;
  createdAt: string;
}

interface Props {
  canViewNominal: boolean;
  canUseAI: boolean;
}

export function AIPredictionWidget({ canViewNominal, canUseAI }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = (force: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await generatePrediction(force ? { force: true } : undefined);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      if (res.data) {
        setResult(res.data);
      }
    });
  };

  if (!canUseAI) {
    return (
      <div className="rounded-xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-text-muted" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-text-primary">AI Prediction</h2>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          Role kamu tidak punya akses ke AI predictions (butuh admin/manager/spv).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-mint/40 via-surface to-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal" strokeWidth={1.5} />
            <h2 className="text-base font-semibold text-text-primary">
              AI Prediction · 7 Hari ke Depan
            </h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Powered by Claude {result?.model ?? 'Sonnet 4.6'} · cache 24 jam
            {result ? (
              <>
                {' · '}
                {result.cached ? 'cached' : 'fresh'} · {formatDate(result.createdAt)}{' '}
                {new Date(result.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Jakarta',
                })}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          {result ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => handleGenerate(true)}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
              )}
              Refresh
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={pending} onClick={() => handleGenerate(false)}>
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                  Generate Insight
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      ) : null}

      {!result && !error && !pending ? (
        <div className="mt-4 rounded-lg border border-dashed border-border-default p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-teal/50" strokeWidth={1.5} />
          <p className="mt-2 text-sm font-medium text-forest dark:text-cream">
            Belum ada prediksi tersimpan
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            Klik "Generate Insight" untuk minta Claude analisa pola sales 30 hari + prediksi
            7 hari ke depan + reorder suggestions.
          </p>
        </div>
      ) : null}

      {pending && !result ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-teal/40 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-teal" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary">
            Claude lagi analisa data… (~5-15 detik)
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 flex flex-col gap-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Ringkasan
            </h3>
            <p className="mt-1 text-sm text-text-primary">{result.summary}</p>
            <p className="mt-1 text-xs text-text-secondary">{result.trend_analysis}</p>
          </section>

          <section>
            <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
              Forecast 7 Hari
            </h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="px-2 py-2 text-left">Tanggal</th>
                    <th className="px-2 py-2 text-right">Revenue</th>
                    <th className="px-2 py-2 text-right">Trx</th>
                    <th className="px-2 py-2 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {result.forecast_7days.map((day) => (
                    <tr key={day.date} className="border-b border-border-default/50">
                      <td className="px-2 py-2 font-mono text-xs">{formatDate(day.date)}</td>
                      <td className="px-2 py-2 text-right font-mono">
                        {canViewNominal ? formatCurrency(day.predicted_revenue) : '••••'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {formatNumber(day.predicted_trx)}
                      </td>
                      <td className="px-2 py-2 text-xs text-text-secondary">{day.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.reorder_suggestions.length > 0 ? (
            <section>
              <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <ShoppingCart className="h-3 w-3" strokeWidth={1.5} />
                Reorder Suggestions
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {result.reorder_suggestions.map((s, idx) => (
                  <li
                    key={`${s.product_name}-${idx}`}
                    className="flex flex-col gap-1 rounded-lg bg-surface p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {s.product_name}
                      </span>
                      <UrgencyBadge urgency={s.urgency} />
                    </div>
                    <p className="text-xs text-text-secondary">{s.reason}</p>
                    <p className="text-xs text-teal">→ {s.suggested_action}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.risk_alerts.length > 0 ? (
            <section>
              <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                Risk Alerts
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {result.risk_alerts.map((alert, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-text-primary"
                  >
                    {alert}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[10px] text-text-muted">
            Token: {formatNumber(result.input_tokens)} in · {formatNumber(result.output_tokens)} out
            · Estimasi cost ~${(
              (result.input_tokens * 3 + result.output_tokens * 15) /
              1_000_000
            ).toFixed(4)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-mint text-teal',
    medium: 'bg-warning/20 text-warning',
    high: 'bg-danger/15 text-danger',
  } as const;
  const labels = { low: 'Low', medium: 'Medium', high: 'High' } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[urgency]}`}
    >
      {labels[urgency]}
    </span>
  );
}

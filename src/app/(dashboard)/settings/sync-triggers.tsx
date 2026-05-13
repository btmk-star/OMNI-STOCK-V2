'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  triggerProductSync,
  triggerStockCardSync,
  triggerTransactionSync,
} from '@/lib/actions/pawoon.actions';

type RunStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'ok'; records: number; durationMs: number }
  | { state: 'err'; message: string };

export function SyncTriggers() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <TriggerCard
        label="Pawoon Products"
        description="Catalog produk Pawoon (~926 items). Recommend setelah ada perubahan menu di Pawoon."
        run={triggerProductSync}
      />
      <TriggerCard
        label="Pawoon Stock Card"
        description="Stok harian per outlet. Pawoon return data H-1, fetch on-demand."
        run={triggerStockCardSync}
      />
      <TriggerCard
        label="Pawoon Transactions"
        description="Incremental sync transaksi baru. Default 5 menit (kalau cron aktif)."
        run={triggerTransactionSync}
      />
    </div>
  );
}

function TriggerCard({
  label,
  description,
  run,
}: {
  label: string;
  description: string;
  run: () => Promise<{ data?: { records_synced?: number; duration_ms?: number } } | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RunStatus>({ state: 'idle' });

  function handleClick() {
    setStatus({ state: 'pending' });
    startTransition(async () => {
      const res = await run();
      if ('error' in res && res.error) {
        setStatus({ state: 'err', message: res.error });
        return;
      }
      const data = 'data' in res ? res.data : undefined;
      setStatus({
        state: 'ok',
        records: data?.records_synced ?? 0,
        durationMs: data?.duration_ms ?? 0,
      });
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={pending}>
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
          ) : (
            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          )}
          Sync
        </Button>
      </div>
      <p className="text-xs text-text-secondary">{description}</p>
      {status.state === 'ok' ? (
        <p className="flex items-center gap-1 text-[11px] text-success">
          <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
          {status.records.toLocaleString('id-ID')} records · {(status.durationMs / 1000).toFixed(1)}s
        </p>
      ) : null}
      {status.state === 'err' ? (
        <p className="flex items-start gap-1 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

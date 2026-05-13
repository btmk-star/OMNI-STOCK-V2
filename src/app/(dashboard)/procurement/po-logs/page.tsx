import Link from 'next/link';
import { History } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils/format';

interface LogRow {
  id: string;
  po_id: string;
  action: string;
  actor_role: string | null;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

export default async function POLogsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_po_logs')
    .select('id,po_id,action,actor_role,old_status,new_status,notes,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const logs = (data ?? []) as unknown as LogRow[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-teal" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">PO Logs</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Global audit trail · siapa melakukan apa di PO, kapan, status changed
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {error.message}
        </p>
      ) : null}

      {logs.length === 0 ? (
        <div className="rounded-xl bg-surface p-12 text-center shadow-card">
          <History className="mx-auto h-10 w-10 text-teal/40" strokeWidth={1.5} />
          <p className="mt-3 text-base font-medium text-forest dark:text-cream">
            Belum ada log PO
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
            Log akan auto-tercatat saat user melakukan aksi di PO (create, submit, approve, order, receive, cancel).
            Aktif setelah CRUD form PO live di Phase 3d.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Status Change</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border-default/50 text-sm hover:bg-mint/30">
                    <td className="px-4 py-3 text-text-secondary">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/procurement/purchase-orders/${encodeURIComponent(log.po_id)}`}
                        className="font-mono text-[12px] text-teal hover:underline"
                      >
                        {log.po_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{log.action}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {log.old_status && log.new_status ? (
                        <span className="font-mono text-[12px]">
                          {log.old_status} → {log.new_status}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.actor_role ? (
                        <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-medium text-teal">
                          {log.actor_role}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs max-w-md truncate">
                      {log.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { redirect } from 'next/navigation';
import { Activity, Database, MessageCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, ROLE_LABELS, type Role } from '@/config/roles';
import { availableProviders } from '@/lib/wa';
import { fonnteDeviceStatus } from '@/lib/wa/fonnte';
import { WORKFLOW_LABELS } from '@/lib/pawoon/sync-runners';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { SyncTriggers } from './sync-triggers';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: meProfile } = await supabase
    .from('user_profiles')
    .select('role,full_name,email')
    .eq('id', userData.user.id)
    .single<{ role: Role; full_name: string | null; email: string | null }>();

  const canManage = hasPermission(meProfile?.role ?? null, 'settings.manage');

  // Stats: last Pawoon sync per workflow + AI prediction usage
  const [
    { data: lastProductSync },
    { data: lastStockSync },
    { data: lastTrxSync },
    { count: trxCount },
    { count: predictionCount },
    { count: poCount },
  ] = await Promise.all([
    supabase
      .from('pawoon_sync_log')
      .select('synced_at,status,records_synced,duration_ms,error')
      .eq('workflow', WORKFLOW_LABELS.product)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        synced_at: string;
        status: string;
        records_synced: number;
        duration_ms: number;
        error: string | null;
      }>(),
    supabase
      .from('pawoon_sync_log')
      .select('synced_at,status,records_synced,duration_ms,error')
      .eq('workflow', WORKFLOW_LABELS.stockCard)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        synced_at: string;
        status: string;
        records_synced: number;
        duration_ms: number;
        error: string | null;
      }>(),
    supabase
      .from('pawoon_sync_log')
      .select('synced_at,status,records_synced,duration_ms,error')
      .eq('workflow', WORKFLOW_LABELS.transaction)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        synced_at: string;
        status: string;
        records_synced: number;
        duration_ms: number;
        error: string | null;
      }>(),
    supabase
      .from('pawoon_transactions')
      .select('pawoon_id', { count: 'exact', head: true }),
    supabase
      .from('os_ai_predictions')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('os_purchase_orders')
      .select('id', { count: 'exact', head: true }),
  ]);

  const waProviders = availableProviders();
  const fonnte = waProviders.includes('fonnte') ? await fonnteDeviceStatus() : null;
  const claudeConfigured = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">Settings</h1>
        <p className="text-sm text-text-secondary">
          Status integrasi · manual sync triggers · info akun
        </p>
      </header>

      {/* Account info */}
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          <ShieldCheck className="h-4 w-4 text-teal" strokeWidth={1.5} />
          Akun Kamu
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Nama" value={meProfile?.full_name ?? '—'} />
          <Detail label="Email" value={meProfile?.email ?? userData.user.email ?? '—'} mono />
          <Detail
            label="Role"
            value={meProfile?.role ? ROLE_LABELS[meProfile.role] : '—'}
          />
        </div>
      </section>

      {/* Integrasi */}
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          <Activity className="h-4 w-4 text-teal" strokeWidth={1.5} />
          Status Integrasi
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard
            icon={<Database className="h-5 w-5 text-teal" strokeWidth={1.5} />}
            title="Pawoon"
            status={lastProductSync ? 'connected' : 'pending'}
            detail={
              lastProductSync
                ? `Last product sync: ${formatDateTime(lastProductSync.synced_at)} · ${lastProductSync.records_synced} records · ${lastProductSync.status}`
                : 'Belum ada sync — trigger manual di bawah'
            }
            extra={
              <div className="flex flex-col gap-1 text-[11px] text-text-muted">
                {lastStockSync ? (
                  <span>Stock card: {formatDate(lastStockSync.synced_at)} · {lastStockSync.records_synced} rec</span>
                ) : null}
                {lastTrxSync ? (
                  <span>Transaction: {formatDate(lastTrxSync.synced_at)} · {lastTrxSync.records_synced} rec · total {(trxCount ?? 0).toLocaleString('id-ID')} di DB</span>
                ) : null}
              </div>
            }
          />

          <IntegrationCard
            icon={<MessageCircle className="h-5 w-5 text-teal" strokeWidth={1.5} />}
            title="WhatsApp Gateway"
            status={
              waProviders.length === 0
                ? 'not_configured'
                : fonnte?.connected
                  ? 'connected'
                  : 'warning'
            }
            detail={
              waProviders.length === 0
                ? 'Belum ada provider terkonfigurasi (Fonnte / KirimChat)'
                : `Provider aktif: ${waProviders.join(', ')}`
            }
            extra={
              fonnte ? (
                <div className="text-[11px] text-text-muted">
                  Fonnte device: <span className="font-mono">{fonnte.device ?? '—'}</span> ·{' '}
                  {fonnte.connected ? (
                    <span className="text-success">connected</span>
                  ) : (
                    <span className="text-warning">disconnect</span>
                  )}
                </div>
              ) : null
            }
          />

          <IntegrationCard
            icon={<Sparkles className="h-5 w-5 text-teal" strokeWidth={1.5} />}
            title="Claude AI"
            status={claudeConfigured ? 'connected' : 'not_configured'}
            detail={
              claudeConfigured
                ? `Model: Sonnet 4.6 · cache 24 jam · ${(predictionCount ?? 0).toLocaleString('id-ID')} prediksi tersimpan`
                : 'ANTHROPIC_API_KEY belum di-set'
            }
          />
        </div>
      </section>

      {/* Sync triggers */}
      {canManage ? (
        <section className="rounded-xl bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            <Database className="h-4 w-4 text-teal" strokeWidth={1.5} />
            Manual Sync Triggers
          </h2>
          <p className="mb-3 text-xs text-text-muted">
            Pawoon sync biasanya di-trigger via Refresh button di module masing-masing. Tombol
            di sini untuk debugging atau force-refresh.
          </p>
          <SyncTriggers />
        </section>
      ) : null}

      {/* App info */}
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          App Info
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="App Name" value={process.env.NEXT_PUBLIC_APP_NAME ?? 'OMNI-STOCK'} />
          <Detail label="Environment" value={process.env.VERCEL_ENV ?? 'development'} />
          <Detail
            label="Counters"
            value={`${(poCount ?? 0).toLocaleString('id-ID')} PO · ${(trxCount ?? 0).toLocaleString('id-ID')} trx`}
          />
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function IntegrationCard({
  icon,
  title,
  status,
  detail,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  status: 'connected' | 'warning' | 'not_configured' | 'pending';
  detail: string;
  extra?: React.ReactNode;
}) {
  const statusStyles = {
    connected: { label: 'Connected', cls: 'bg-success/15 text-success' },
    warning: { label: 'Warning', cls: 'bg-warning/15 text-warning' },
    not_configured: { label: 'Not Configured', cls: 'bg-text-muted/15 text-text-muted' },
    pending: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  } as const;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-text-primary">{title}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyles[status].cls}`}
        >
          {statusStyles[status].label}
        </span>
      </div>
      <p className="text-xs text-text-secondary">{detail}</p>
      {extra}
    </div>
  );
}

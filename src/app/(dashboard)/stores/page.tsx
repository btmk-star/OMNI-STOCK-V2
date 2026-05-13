import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { MapPin, Phone, Building2 } from 'lucide-react';

interface OutletRow {
  pawoon_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  raw_data: {
    is_open?: boolean;
    city_name?: string;
    province_name?: string;
    add_ons?: string[];
    created_at?: string;
  } | null;
  created_at: string | null;
}

export default async function StoresPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pawoon_outlets')
    .select('pawoon_id,name,address,phone,is_active,raw_data,created_at')
    .order('name');

  const outlets = (data ?? []) as unknown as OutletRow[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">Stores</h1>
        <p className="text-sm text-text-secondary">
          {outlets.length} outlet · sync dari Pawoon + internal V1.6
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {error.message}
        </p>
      ) : null}

      {outlets.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-card">
          <p className="text-base font-medium text-forest">Belum ada outlet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {outlets.map((outlet) => {
            const isInternal = outlet.pawoon_id.startsWith('INTERNAL-');
            const cityProvince = [outlet.raw_data?.city_name, outlet.raw_data?.province_name]
              .filter(Boolean)
              .join(', ');
            return (
              <div
                key={outlet.pawoon_id}
                className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <Building2 className="h-5 w-5 text-teal" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold text-text-primary">{outlet.name}</h3>
                  </div>
                  {isInternal ? (
                    <Badge variant="syncStale">Internal</Badge>
                  ) : outlet.raw_data?.is_open ? (
                    <Badge variant="stockSafe">Open</Badge>
                  ) : (
                    <Badge variant="poDraft">Closed</Badge>
                  )}
                </div>

                {outlet.address ? (
                  <div className="flex items-start gap-2 text-sm text-text-secondary">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" strokeWidth={1.5} />
                    <span>{outlet.address}</span>
                  </div>
                ) : null}

                {cityProvince ? (
                  <p className="text-xs text-text-muted">{cityProvince}</p>
                ) : null}

                {outlet.phone ? (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
                    <span className="font-mono text-xs">{outlet.phone}</span>
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between border-t border-border-default pt-3 text-[11px] text-text-muted">
                  <span className="font-mono">{outlet.pawoon_id.slice(0, 8)}…</span>
                  {outlet.created_at ? (
                    <span>Sync {formatDate(outlet.created_at)}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

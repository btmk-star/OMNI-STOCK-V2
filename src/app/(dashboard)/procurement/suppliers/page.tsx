import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { SuppliersTable, type SupplierRow } from './suppliers-table';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; show?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (userData.user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single<{ role: Role }>();
    role = profile?.role ?? null;
  }
  const canManage = hasPermission(role, 'suppliers.manage');

  let query = supabase
    .from('os_suppliers')
    .select(
      'id,name,contact_person,phone,whatsapp,email,address,type,payment_terms,lead_time_days,rating,is_active,notes',
      { count: 'exact' },
    )
    .order('name');

  if (params.show !== 'all') query = query.eq('is_active', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);
  if (params.type) query = query.eq('type', params.type);

  const { data, count, error } = await query;

  return (
    <SuppliersTable
      initial={(data ?? []) as unknown as SupplierRow[]}
      total={count ?? 0}
      query={params.q ?? ''}
      typeFilter={params.type ?? ''}
      showInactive={params.show === 'all'}
      fetchError={error?.message ?? null}
      canManage={canManage}
    />
  );
}

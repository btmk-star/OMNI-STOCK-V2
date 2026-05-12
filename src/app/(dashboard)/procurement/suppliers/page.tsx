import { createClient } from '@/lib/supabase/server';
import { SuppliersTable, type SupplierRow } from './suppliers-table';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('os_suppliers')
    .select(
      'id,name,contact_person,phone,whatsapp,email,address,type,payment_terms,lead_time_days,rating,is_active,notes',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .order('name');

  if (params.q) query = query.ilike('name', `%${params.q}%`);
  if (params.type) query = query.eq('type', params.type);

  const { data, count, error } = await query;

  return (
    <SuppliersTable
      initial={(data ?? []) as unknown as SupplierRow[]}
      total={count ?? 0}
      query={params.q ?? ''}
      typeFilter={params.type ?? ''}
      fetchError={error?.message ?? null}
    />
  );
}

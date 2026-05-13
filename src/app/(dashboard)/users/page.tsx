import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';
import { UsersTable, type UserRow } from './users-table';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: meProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();

  if (!hasPermission(meProfile?.role ?? null, 'users.manage')) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">Users</h1>
        <div className="rounded-xl bg-danger/10 p-4 text-sm text-danger">
          Halaman ini hanya untuk role <strong>admin</strong>. Role kamu:{' '}
          {meProfile?.role ?? 'unknown'}.
        </div>
      </div>
    );
  }

  const [{ data: users, error }, { data: outletList }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id,email,full_name,phone,role,outlet_ids,is_active,created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('pawoon_outlets')
      .select('pawoon_id,name')
      .eq('is_active', true)
      .order('name'),
  ]);

  const userRows = ((users ?? []) as unknown as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: Role;
    outlet_ids: string[] | null;
    is_active: boolean;
    created_at: string | null;
  }>).map<UserRow>((u) => ({
    ...u,
    outlet_ids: u.outlet_ids ?? [],
  }));

  const outlets = (outletList ?? [])
    .map((o) => {
      const id = (o.pawoon_id as string | null) ?? (o.name as string | null);
      const name = (o.name as string | null) ?? (o.pawoon_id as string | null);
      return { id: id ?? '', name: name ?? '' };
    })
    .filter((o) => o.id);

  return (
    <UsersTable
      users={userRows}
      outlets={outlets}
      currentUserId={userData.user.id}
      fetchError={error?.message ?? null}
    />
  );
}

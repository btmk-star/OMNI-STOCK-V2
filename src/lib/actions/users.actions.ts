'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasPermission, ROLES, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const ROLE_VALUES = Object.values(ROLES) as [Role, ...Role[]];

const InviteSchema = z.object({
  email: z.string().trim().email('Email tidak valid').max(255),
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(ROLE_VALUES),
  outlet_ids: z.array(z.string().trim().min(1).max(50)).default([]),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72),
});

const UpdateSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(ROLE_VALUES),
  outlet_ids: z.array(z.string().trim().min(1).max(50)).default([]),
});

export type InviteUserInput = z.infer<typeof InviteSchema>;
export type UpdateUserInput = z.infer<typeof UpdateSchema>;

interface AuthCtx {
  userId: string;
}

async function authorizeAdmin(): Promise<{ ok: AuthCtx } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  if (!hasPermission(profile?.role ?? null, 'users.manage')) {
    return { error: 'Hanya admin yang bisa kelola user' };
  }
  return { ok: { userId: userData.user.id } };
}

export async function inviteUser(
  input: InviteUserInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeAdmin();
  if ('error' in auth) return { error: auth.error };
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (createErr) return { error: `Create user gagal: ${createErr.message}` };
  if (!created.user) return { error: 'Create user gagal: response kosong' };

  // Trigger fn_handle_new_user sudah insert baseline profile.
  // Update dengan role + outlet + phone.
  const { error: profErr } = await admin
    .from('user_profiles')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      outlet_ids: parsed.data.outlet_ids,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.user.id);
  if (profErr) return { error: `Update profile gagal: ${profErr.message}` };

  revalidatePath('/users');
  return { data: { id: created.user.id } };
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeAdmin();
  if ('error' in auth) return { error: auth.error };
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  // Self-protection: tidak boleh demote diri sendiri dari admin
  if (id === auth.ok.userId && parsed.data.role !== 'admin') {
    return { error: 'Tidak boleh ubah role admin diri sendiri (cegah lockout)' };
  }

  // Last-admin protection
  if (parsed.data.role !== 'admin') {
    const supabase = await createClient();
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true);
    const { data: target } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle<{ role: Role }>();
    if (target?.role === 'admin' && (count ?? 0) <= 1) {
      return { error: 'Tidak boleh demote admin terakhir' };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profiles')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      outlet_ids: parsed.data.outlet_ids,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/users');
  return { data: { id } };
}

export async function toggleUserActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeAdmin();
  if ('error' in auth) return { error: auth.error };

  if (id === auth.ok.userId && !active) {
    return { error: 'Tidak boleh nonaktifkan diri sendiri' };
  }

  // Last-admin protection
  if (!active) {
    const supabase = await createClient();
    const { data: target } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle<{ role: Role }>();
    if (target?.role === 'admin') {
      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);
      if ((count ?? 0) <= 1) {
        return { error: 'Tidak boleh nonaktifkan admin terakhir' };
      }
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profiles')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/users');
  return { data: { id } };
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeAdmin();
  if ('error' in auth) return { error: auth.error };
  if (newPassword.length < 8) return { error: 'Password minimal 8 karakter' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (error) return { error: `Reset password gagal: ${error.message}` };

  revalidatePath('/users');
  return { data: { id } };
}

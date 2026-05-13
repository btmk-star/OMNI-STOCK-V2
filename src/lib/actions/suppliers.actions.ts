'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

const SupplierSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(255),
  type: z.enum(['kerjasama', 'non_kerjasama', 'online_shop']),
  contact_person: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  whatsapp: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email('Email tidak valid').max(255).optional().or(z.literal('')).nullable(),
  address: z.string().trim().max(2000).optional().nullable(),
  payment_terms: z.string().trim().max(50).optional().nullable(),
  lead_time_days: z.number().int().min(0).max(365).optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type SupplierInput = z.infer<typeof SupplierSchema>;

async function authorize(): Promise<{ role: Role; userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single<{ role: Role }>();
  if (!hasPermission(profile?.role ?? null, 'suppliers.manage')) {
    return { error: 'Role kamu tidak punya akses untuk kelola supplier' };
  }
  return { role: profile!.role, userId };
}

function normalizePayload(input: SupplierInput) {
  const empty = (v?: string | null) => (v == null || v.trim() === '' ? null : v.trim());
  return {
    name: input.name.trim(),
    type: input.type,
    contact_person: empty(input.contact_person),
    phone: empty(input.phone),
    whatsapp: empty(input.whatsapp),
    email: empty(input.email),
    address: empty(input.address),
    payment_terms: empty(input.payment_terms),
    lead_time_days: input.lead_time_days ?? null,
    rating: input.rating ?? null,
    notes: empty(input.notes),
  };
}

async function generateSupplierId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_suppliers')
    .select('id')
    .like('id', 'SUP-%')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = /^SUP-(\d+)$/.exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `SUP-${String(next).padStart(4, '0')}`;
}

export async function createSupplier(
  rawInput: SupplierInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };

  const parsed = SupplierSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = await createClient();
  const id = await generateSupplierId();
  const payload = { id, ...normalizePayload(parsed.data), is_active: true };

  const { error } = await supabase.from('os_suppliers').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/procurement/suppliers');
  return { data: { id } };
}

export async function updateSupplier(
  id: string,
  rawInput: SupplierInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };

  const parsed = SupplierSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = await createClient();
  const payload = { ...normalizePayload(parsed.data), updated_at: new Date().toISOString() };
  const { error } = await supabase.from('os_suppliers').update(payload).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/procurement/suppliers');
  return { data: { id } };
}

export async function deactivateSupplier(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('os_suppliers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/procurement/suppliers');
  return { data: { id } };
}

export async function reactivateSupplier(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if ('error' in auth) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('os_suppliers')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/procurement/suppliers');
  return { data: { id } };
}

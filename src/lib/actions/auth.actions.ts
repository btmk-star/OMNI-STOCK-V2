'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LoginSchema } from '@/lib/utils/validators';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

export async function loginAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    const firstError =
      issues.email?.[0] ?? issues.password?.[0] ?? 'Input tidak valid';
    return { error: firstError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'Email atau password salah' };
  }

  const next = (formData.get('next') as string | null) ?? '/';
  revalidatePath('/', 'layout');
  return { data: { redirectTo: next } };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAction } from '@/lib/actions/auth.actions';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      formData.set('next', nextPath);
      const result = await loginAction(formData);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if ('data' in result && result.data) {
        router.replace(result.data.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-card">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-text-primary">Masuk OMNI-STOCK</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Gunakan akun terdaftar EGG Group.
        </p>
      </header>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-forest">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@easygoing.id"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-forest">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            minLength={8}
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Masuk...
            </>
          ) : (
            'Masuk'
          )}
        </Button>
      </form>
    </div>
  );
}

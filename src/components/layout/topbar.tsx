'use client';

import { Bell, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { useUser } from '@/lib/hooks/use-user';
import { useRole } from '@/lib/hooks/use-role';
import { ROLE_LABELS } from '@/config/roles';
import { logoutAction } from '@/lib/actions/auth.actions';

export function Topbar() {
  const { user } = useUser();
  const { role } = useRole();
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border-default bg-surface px-4 sm:px-6 dark:bg-surface">
      <div className="hidden md:block flex-1 max-w-sm">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.5}
          />
          <Input placeholder="Cari menu, bahan, PO..." className="pl-9" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" strokeWidth={1.5} />
        </Button>
        <ThemeToggle />

        <div className="ml-2 hidden sm:flex items-center gap-2 border-l border-border-default pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-xs font-semibold text-teal">
            {initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium text-text-primary truncate max-w-[160px]">
              {user?.email ?? 'Anonymous'}
            </span>
            <span className="text-[11px] text-text-muted">
              {role ? ROLE_LABELS[role] : '—'}
            </span>
          </div>
        </div>

        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Logout">
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
          </Button>
        </form>
      </div>
    </header>
  );
}

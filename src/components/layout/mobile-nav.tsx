'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV } from '@/config/nav';
import { hasPermission } from '@/config/roles';
import { useRole } from '@/lib/hooks/use-role';
import { cn } from '@/lib/utils/cn';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const { role } = useRole();

  const items = MOBILE_NAV.filter(
    (item) => !item.permission || hasPermission(role, item.permission),
  );

  return (
    <nav className="md:hidden sticky bottom-0 z-20 grid grid-cols-5 border-t border-border-default bg-surface">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-teal' : 'text-text-muted hover:text-forest',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

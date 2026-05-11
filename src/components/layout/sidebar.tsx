'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NAV_SECTIONS, type NavItem } from '@/config/nav';
import { hasPermission } from '@/config/roles';
import { useRole } from '@/lib/hooks/use-role';
import { SITE_CONFIG } from '@/config/site';
import { cn } from '@/lib/utils/cn';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors',
        active
          ? 'bg-mint text-teal font-medium'
          : 'text-forest/70 hover:bg-mint/40 dark:text-cream/80',
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lime" />
      ) : null}
      <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.5} />
      {collapsed ? null : <span>{item.label}</span>}
    </Link>
  );
}

interface SidebarBodyProps {
  pathname: string;
  collapsed?: boolean;
  onItemClick?: () => void;
}

function SidebarBody({ pathname, collapsed, onItemClick }: SidebarBodyProps) {
  const { role } = useRole();

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-2 py-4">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.permission || hasPermission(role, item.permission),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <hr className="my-2 border-border-default" />
            ) : (
              <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-forest/40 dark:text-cream/40">
                {section.label}
              </p>
            )}
            {visibleItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onClick={onItemClick}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-4 py-5">
      <Image
        src="/logo.svg"
        alt=""
        width={28}
        height={28}
        className="block dark:hidden"
      />
      <Image
        src="/logo-dark.svg"
        alt=""
        width={28}
        height={28}
        className="hidden dark:block"
      />
      {collapsed ? null : (
        <span className="font-bold text-text-primary">{SITE_CONFIG.name}</span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar (lg and up: w-64) */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col border-r border-border-default bg-surface dark:bg-forest h-screen sticky top-0">
        <Brand />
        <SidebarBody pathname={pathname} />
      </aside>

      {/* Tablet sidebar (md only: w-16 icons) */}
      <aside className="hidden md:flex lg:hidden w-16 flex-shrink-0 flex-col border-r border-border-default bg-surface dark:bg-forest h-screen sticky top-0">
        <Brand collapsed />
        <SidebarBody pathname={pathname} collapsed />
      </aside>

      {/* Mobile hamburger trigger lives in topbar; drawer here */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="fixed left-3 top-3 z-30"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </Button>

        {mobileOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-40 bg-midnight/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="h-full w-72 bg-surface dark:bg-forest shadow-card flex flex-col"
            >
              <div className="flex items-center justify-between pr-3">
                <Brand />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </Button>
              </div>
              <SidebarBody pathname={pathname} onItemClick={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

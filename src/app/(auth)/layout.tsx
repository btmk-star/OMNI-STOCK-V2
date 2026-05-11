import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        href="/login"
        className="mb-8 flex items-center gap-3"
        aria-label={SITE_CONFIG.fullName}
      >
        <Image
          src="/logo.svg"
          alt=""
          width={40}
          height={40}
          className="block dark:hidden"
        />
        <Image
          src="/logo-dark.svg"
          alt=""
          width={40}
          height={40}
          className="hidden dark:block"
        />
        <span className="font-bold text-xl text-text-primary">
          {SITE_CONFIG.name}
        </span>
      </Link>

      <main className="w-full max-w-sm">{children}</main>

      <footer className="mt-8 text-xs text-text-muted">
        v{SITE_CONFIG.version} · Pawoon-First Architecture
      </footer>
    </div>
  );
}

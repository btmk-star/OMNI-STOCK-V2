import { Construction } from 'lucide-react';

interface PageStubProps {
  title: string;
  subtitle?: string;
  phase: string;
}

export function PageStub({ title, subtitle, phase }: PageStubProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-midnight dark:text-cream">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-text-secondary">{subtitle}</p>
        ) : null}
      </header>

      <div className="rounded-xl bg-surface p-8 shadow-card">
        <div className="flex flex-col items-center gap-3 text-center">
          <Construction className="h-10 w-10 text-teal/40" strokeWidth={1.5} />
          <p className="text-base font-medium text-forest dark:text-cream">
            Coming in {phase}
          </p>
          <p className="max-w-md text-sm text-text-muted">
            Halaman ini masih placeholder. Implementasi lengkap masuk roadmap {phase}.
          </p>
        </div>
      </div>
    </div>
  );
}

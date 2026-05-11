import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-10 w-full rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30 focus-visible:border-teal',
          'disabled:opacity-50 disabled:bg-surface-alt',
          'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30 aria-[invalid=true]:border-danger',
          className,
        )}
        {...props}
      />
    );
  },
);

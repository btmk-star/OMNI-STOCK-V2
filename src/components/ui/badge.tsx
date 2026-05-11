import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

// Variants per UI Spec §6.5.
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
  {
    variants: {
      variant: {
        // Stock
        stockSafe: 'bg-mint text-teal',
        stockWarning: 'bg-amber-50 text-amber-700',
        stockCritical: 'bg-red-50 text-red-600',
        // PO statuses
        poDraft: 'bg-slate-100 text-slate-600',
        poSubmitted: 'bg-blue-50 text-blue-600',
        poApproved: 'bg-mint text-teal',
        poOrdered: 'bg-lime/20 text-forest',
        poReceived: 'bg-teal text-white',
        poCancelled: 'bg-red-50 text-red-500',
        // Sync
        syncOk: 'bg-mint text-teal',
        syncStale: 'bg-amber-50 text-amber-600',
        // Type
        typePackaged: 'bg-teal/10 text-teal border border-teal/20 rounded-md',
        typeRawBulk: 'bg-lime/20 text-forest border border-lime/40 rounded-md',
        // Channel
        channelDineIn: 'bg-forest text-cream',
        channelGrabFood: 'bg-lime text-forest',
        // Generic role chip
        role: 'bg-mint text-teal uppercase tracking-wide',
      },
    },
    defaultVariants: { variant: 'stockSafe' },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

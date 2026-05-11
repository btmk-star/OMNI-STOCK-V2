import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

// Variants per UI Spec §6.2.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-white rounded-xl hover:bg-teal/90',
        secondary: 'bg-mint text-teal rounded-xl hover:bg-mint/80',
        outline:
          'border border-border-default text-forest rounded-xl hover:bg-cream dark:text-cream dark:hover:bg-surface-alt',
        ghost: 'text-teal bg-transparent rounded-lg hover:bg-mint/50',
        lime: 'bg-lime text-forest rounded-xl font-semibold hover:bg-lime/90',
        danger: 'bg-danger text-white rounded-xl hover:bg-danger/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        info: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        danger: 'border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

// Insignia del administrador: píldora de 13 px con tono suave del color de estado.
const adminBadgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5',
  {
    variants: {
      variant: {
        default: 'bg-rf-accent text-white',
        secondary: 'bg-rf-fill-strong text-rf-label',
        outline: 'ring-1 ring-inset ring-rf-separator text-rf-label',
        success: 'bg-rf-accent/[0.12] text-rf-accent',
        warning: 'bg-rf-warning/[0.12] text-rf-warning',
        info: 'bg-rf-info/10 text-rf-info',
        danger: 'bg-rf-danger/10 text-rf-danger',
        muted: 'bg-rf-fill-strong text-rf-secondary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  const admin = useAdminSurface();
  return <div className={cn(admin ? adminBadgeVariants({ variant }) : badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };

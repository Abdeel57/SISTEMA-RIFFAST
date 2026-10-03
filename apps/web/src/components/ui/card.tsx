import * as React from 'react';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

// En el administrador la tarjeta es blanca, sin borde y con sombra mínima.
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <div
        ref={ref}
        className={cn(
          admin
            ? 'rounded-card bg-rf-surface text-rf-label shadow-card'
            : 'rounded-2xl border bg-card text-card-foreground shadow-sm',
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <div
        ref={ref}
        className={cn(admin ? 'flex flex-col gap-1 p-4 pb-3' : 'flex flex-col space-y-1.5 p-5', className)}
        {...props}
      />
    );
  },
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <h3
        ref={ref}
        className={cn(
          admin ? 'text-body font-semibold text-rf-label' : 'text-lg font-bold leading-tight tracking-tight',
          className,
        )}
        {...props}
      />
    );
  },
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <p
        ref={ref}
        className={cn(admin ? 'text-callout text-rf-secondary' : 'text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  },
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return <div ref={ref} className={cn(admin ? 'p-4 pt-0' : 'p-5 pt-0', className)} {...props} />;
  },
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return <div ref={ref} className={cn('flex items-center', admin ? 'p-4 pt-0' : 'p-5 pt-0', className)} {...props} />;
  },
);
CardFooter.displayName = 'CardFooter';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';
import { ADMIN_FIELD } from '@/components/ui/input';

// Select nativo estilizado (suficiente para móvil; evita complejidad de Radix Select).
// En el administrador usa el mismo relleno que los campos y abre la rueda nativa.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            admin
              ? cn(ADMIN_FIELD, 'flex h-[50px] appearance-none pr-11')
              : 'flex h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2',
            admin ? 'right-4 h-[18px] w-[18px] text-rf-tertiary' : 'right-3 h-4 w-4 text-muted-foreground',
          )}
        />
      </div>
    );
  },
);
Select.displayName = 'Select';

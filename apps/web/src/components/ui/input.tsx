import * as React from 'react';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

// Campo del ADMINISTRADOR: relleno gris suave sin borde (como iOS), texto de
// 17 px (evita el zoom de iOS), anillo verde al enfocar y rojo si es inválido.
export const ADMIN_FIELD =
  'w-full rounded-control border-0 bg-rf-fill px-4 text-body text-rf-label caret-rf-accent outline-none transition-[background-color,box-shadow] duration-fast placeholder:text-rf-tertiary focus:bg-rf-surface focus:ring-2 focus:ring-rf-accent/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rf-danger/50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          admin
            ? cn(ADMIN_FIELD, 'flex h-[50px] file:border-0 file:bg-transparent file:text-callout file:font-medium')
            : 'flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-base ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    const admin = useAdminSurface();
    return (
      <textarea
        ref={ref}
        className={cn(
          admin
            ? cn(ADMIN_FIELD, 'flex min-h-[104px] py-3 leading-snug')
            : 'flex min-h-[90px] w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

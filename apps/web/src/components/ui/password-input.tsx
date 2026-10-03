import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

// Campo de contraseña con botón para mostrar/ocultar. Pensado para usuarios en
// móvil: ver lo que escriben reduce errores de captura y reintentos de login.
export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const admin = useAdminSurface();
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(admin ? 'pr-12' : 'pr-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className={
            admin
              ? 'absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-rf-secondary outline-none transition-opacity active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45'
              : 'absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          }
        >
          {visible ? (
            <EyeOff className={admin ? 'h-5 w-5' : 'h-4 w-4'} />
          ) : (
            <Eye className={admin ? 'h-5 w-5' : 'h-4 w-4'} />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

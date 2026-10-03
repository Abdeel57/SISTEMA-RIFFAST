import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

// Campo estilo "boleto" para los formularios de autenticación: etiqueta tipo
// serial (Space Mono, mayúsculas) que se enciende al enfocar, icono reactivo y
// input relleno con tinte de papel. El input lo pasa la página (children) con
// `ticketInputClass` para conservar register() de react-hook-form.

export const ticketInputClass =
  'h-12 rounded-xl border-[#E3E9F8] bg-[#F8FAFF] pl-11 font-medium placeholder:font-normal dark:border-border dark:bg-muted/30 transition-colors hover:border-brand/40 focus-visible:border-brand focus-visible:ring-brand/50';

interface Props {
  label: string;
  htmlFor: string;
  icon: LucideIcon;
  error?: string;
  /** Elemento opcional a la derecha de la etiqueta (ej. “¿Olvidaste tu contraseña?”). */
  right?: ReactNode;
  children: ReactNode;
}

export function TicketField({ label, htmlFor, icon: Icon, error, right, children }: Props) {
  return (
    <div className="group">
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={htmlFor}
          className="font-ticket text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors group-focus-within:text-brand"
        >
          {label}
        </Label>
        {right}
      </div>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-brand" />
        {children}
      </div>
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

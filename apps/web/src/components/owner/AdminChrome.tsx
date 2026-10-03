import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// Hueco de la barra superior del panel donde cada pantalla pone SU acción
// (Nueva rifa, Validar boleto…). La pantalla solo renderiza <HeaderAction/>
// donde quiera: se pinta en la barra por portal y se quita al salir.
const HeaderSlotContext = createContext<HTMLElement | null>(null);
export const HeaderSlotProvider = HeaderSlotContext.Provider;

export function HeaderAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  iconOnly = false,
}: {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** Solo el ícono (el texto queda para el lector de pantalla). */
  iconOnly?: boolean;
}) {
  const slot = useContext(HeaderSlotContext);
  if (!slot) return null;
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={cn(
        'flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-body font-semibold text-rf-accent outline-none transition-opacity active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45 disabled:opacity-40',
        iconOnly ? 'w-11' : 'px-2',
      )}
    >
      {Icon && <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      {!iconOnly && <span>{label}</span>}
    </button>,
    slot,
  );
}

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { usePortalContainer } from '@/components/ui/surface';

export interface SheetAction {
  label: string;
  icon?: LucideIcon;
  /** Acción al tocar. Se ejecuta en el mismo toque (WhatsApp/ventanas no se bloquean). */
  onSelect?: () => void;
  /** Enlace: se abre como enlace real (nueva pestaña si `external`). */
  href?: string;
  external?: boolean;
  /** Acción destructiva: en rojo. La confirmación la pide la pantalla. */
  destructive?: boolean;
  disabled?: boolean;
  /** Ocultar sin tener que filtrar la lista a mano. */
  hidden?: boolean;
}

// Hoja de acciones (estilo iOS): las acciones secundarias de una tarjeta suben
// desde abajo, agrupadas, con «Cancelar» aparte. En escritorio es una tarjeta
// centrada. Las destructivas van en rojo y al final.
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  cancelLabel = 'Cancelar',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actions: SheetAction[];
  cancelLabel?: string;
}) {
  const container = usePortalContainer();
  const visible = actions.filter((a) => !a.hidden);
  // Radix solo devuelve el foco a su propio Trigger; esta hoja se abre desde un
  // botón externo («⋯»), así que se recuerda quién tenía el foco al abrirla.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  const rowClass = (a: SheetAction) =>
    cn(
      'rf-row flex min-h-[54px] w-full items-center gap-3.5 px-4 text-left text-body outline-none focus-visible:bg-rf-fill disabled:opacity-40',
      a.destructive ? 'text-rf-danger' : 'text-rf-label',
    );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-rf-fade-in data-[state=closed]:animate-rf-fade-out" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            // Si la acción abrió otro diálogo (confirmación, comprobante…), el
            // foco se queda en él; si no, vuelve al botón «⋯».
            if (!document.querySelector('[role="dialog"]')) opener.current?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 space-y-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-rf-sheet-in data-[state=closed]:animate-rf-sheet-out sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-0 sm:pb-0 sm:data-[state=open]:animate-rf-pop-in sm:data-[state=closed]:animate-rf-pop-out"
        >
          <div className="overflow-hidden rounded-sheet bg-rf-surface shadow-float">
            {title ? (
              <div className="border-b border-rf-separator px-4 py-3 text-center">
                <DialogPrimitive.Title className="text-callout font-semibold text-rf-label">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-caption text-rf-secondary">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            ) : (
              <DialogPrimitive.Title className="sr-only">Acciones</DialogPrimitive.Title>
            )}
            <div className="divide-y divide-rf-separator">
              {visible.map((a) => {
                const Icon = a.icon;
                const content = (
                  <>
                    {Icon && <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.9} />}
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  </>
                );
                if (a.href && !a.disabled) {
                  return (
                    <a
                      key={a.label}
                      href={a.href}
                      target={a.external ? '_blank' : undefined}
                      rel={a.external ? 'noopener noreferrer' : undefined}
                      className={rowClass(a)}
                      onClick={() => {
                        a.onSelect?.();
                        onOpenChange(false);
                      }}
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <button
                    key={a.label}
                    type="button"
                    disabled={a.disabled}
                    className={rowClass(a)}
                    onClick={() => {
                      // Primero la acción (dentro del gesto del toque), luego cerrar.
                      a.onSelect?.();
                      onOpenChange(false);
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogPrimitive.Close className="rf-row flex h-[54px] w-full items-center justify-center rounded-sheet bg-rf-surface text-body font-semibold text-rf-accent shadow-float outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 sm:hidden">
            {cancelLabel}
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

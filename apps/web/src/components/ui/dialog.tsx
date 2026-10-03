import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAdminSurface, usePortalContainer } from '@/components/ui/surface';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// En el administrador el diálogo es una HOJA que sube desde abajo en celular
// (al alcance del pulgar, con su asa) y una tarjeta centrada en escritorio.
// Movimiento corto (200–250 ms) y fondo oscurecido sin desenfoque (rápido en
// celulares de gama media).
const ADMIN_OVERLAY =
  'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-rf-fade-in data-[state=closed]:animate-rf-fade-out';
const ADMIN_CONTENT =
  'fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] gap-4 overflow-y-auto overscroll-contain rounded-t-sheet bg-rf-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 text-rf-label shadow-sheet outline-none data-[state=open]:animate-rf-sheet-in data-[state=closed]:animate-rf-sheet-out sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sheet sm:p-6 sm:shadow-float sm:data-[state=open]:animate-rf-pop-in sm:data-[state=closed]:animate-rf-pop-out';

// En celular la hoja ocupa todo el ancho: el `max-w-*` que pida cada pantalla
// solo aplica desde tablet.
function widthFromTablet(className?: string): string | undefined {
  return className?.replace(/(^|\s)max-w-/g, '$1sm:max-w-');
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => {
  const admin = useAdminSurface();
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay
        className={
          admin
            ? ADMIN_OVERLAY
            : 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
        }
      />
      <DialogPrimitive.Content
        ref={ref}
        className={
          admin
            ? cn(ADMIN_CONTENT, widthFromTablet(className))
            : cn(
                'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-5 shadow-xl rounded-2xl max-h-[85dvh] overflow-y-auto sm:p-6',
                'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2',
                className,
              )
        }
        {...props}
      >
        {admin && <div aria-hidden className="mx-auto mb-1 h-[5px] w-9 shrink-0 rounded-full bg-rf-separator sm:hidden" />}
        {children}
        {!hideClose &&
          (admin ? (
            <DialogPrimitive.Close className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 sm:right-3 sm:top-3">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-rf-fill text-rf-secondary transition-colors active:bg-rf-fill-strong">
                <X className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          ) : (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          ))}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const admin = useAdminSurface();
  return (
    <div
      className={cn(admin ? 'flex flex-col gap-1.5 pr-10 text-left' : 'flex flex-col space-y-1.5 text-left', className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const admin = useAdminSurface();
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(admin ? 'text-heading text-rf-label' : 'text-lg font-bold leading-none tracking-tight', className)}
      {...props}
    />
  );
});
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const admin = useAdminSurface();
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(admin ? 'text-callout text-rf-secondary' : 'text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const admin = useAdminSurface();
  return (
    <div
      className={cn(
        admin
          ? 'mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto'
          : 'flex flex-col-reverse sm:flex-row sm:justify-end gap-2',
        className,
      )}
      {...props}
    />
  );
}

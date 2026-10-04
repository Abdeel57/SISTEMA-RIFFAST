import { RefreshCw, X } from 'lucide-react';
import { useSwUpdate } from '@/lib/pwa/swUpdate';

// Aviso «Hay una versión nueva · Actualizar» del administrador. Flota arriba,
// bajo la barra del título, sin tapar la navegación ni las pestañas.
export function UpdatePrompt() {
  const { needRefresh, update, dismiss } = useSwUpdate();
  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+52px)] z-[45] flex justify-center px-gutter">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-[380px] animate-rf-rise items-center gap-2 rounded-full bg-rf-surface py-1 pl-4 pr-1 text-rf-label shadow-float"
      >
        <RefreshCw className="h-[18px] w-[18px] shrink-0 text-rf-accent" />
        <p className="min-w-0 flex-1 truncate text-callout font-medium">Nueva versión lista</p>
        <button
          type="button"
          onClick={update}
          className="rf-gem rf-gem-press h-10 shrink-0 rounded-full px-4 text-callout font-semibold outline-none transition-opacity active:opacity-80 focus-visible:ring-2 focus-visible:ring-rf-accent/45 focus-visible:ring-offset-2"
        >
          Actualizar
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ahora no"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-rf-secondary outline-none active:bg-rf-fill focus-visible:ring-2 focus-visible:ring-rf-accent/45"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

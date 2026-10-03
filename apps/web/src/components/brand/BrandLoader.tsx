import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import cloverUrl from '@/assets/riffast-clover.svg';

// Recorta la capa del destello a la silueta del trébol (SVG transparente).
function maskFor(url: string): CSSProperties {
  return {
    maskImage: `url(${url})`,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  };
}

// Pantalla de carga de marca: el trébol de Riffast quieto, barrido por un
// destello diagonal. Sin texto.
//   fullScreen (default): overlay fijo sobre "noche" (#03120C) — el trébol verde
//     respira sobre un aura verde pulsante. Cargas de página completas.
//   fullScreen=false: versión compacta sobre fondo claro (ej. boletera).
export function BrandLoader({
  fullScreen = true,
  className,
}: {
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        fullScreen
          ? 'brand-loader-in fixed inset-0 z-50 grid place-items-center bg-[#03120C]'
          : 'grid place-items-center py-14',
        className,
      )}
      style={
        fullScreen
          ? { backgroundImage: 'radial-gradient(620px circle at 50% 50%, rgba(16,198,95,0.14), transparent 65%)' }
          : undefined
      }
    >
      <div className={cn('relative grid place-items-center', fullScreen ? 'h-24 w-24' : 'h-12 w-12')}>
        {/* Aura de marca: halo verde que late detrás del trébol. */}
        {fullScreen && <div aria-hidden className="brand-loader-aura absolute -inset-7 rounded-full" />}
        <img
          src={cloverUrl}
          alt=""
          draggable={false}
          className={cn(
            'relative h-full w-full select-none object-contain',
            fullScreen ? 'brand-loader-breathe' : 'opacity-90',
          )}
        />
        {/* Destello diagonal recortado a la silueta del trébol. */}
        <div aria-hidden className="brand-loader-shine absolute inset-0" style={maskFor(cloverUrl)} />
      </div>
    </div>
  );
}

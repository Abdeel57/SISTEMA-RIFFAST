import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { useIntroHold } from '@/lib/intro';
import cloverUrl from '@/assets/riffast-clover.svg';

// Recorta una capa a la silueta del trébol (SVG transparente).
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

// Fondo de la intro (public/riffast-intro.js): verde #008B5A con la misma luz
// radial que calcula la intro (shade +6 % al centro, −10 % en los bordes).
const INTRO_BG = 'radial-gradient(120% 90% at 50% 46%, #0F9264 0%, #008B5A 52%, #007D51 100%)';

// Caja del trébol dentro del lienzo de la intro (viewBox 1000×640, trébol ×1.25
// centrado): x 253.125, y 53.125, 490×530 → en porcentajes del lienzo.
const CLOVER_BOX: CSSProperties = { left: '25.3125%', top: '8.3008%', width: '49%', height: '82.8125%' };

// Pantalla de carga de marca.
//   fullScreen (default): el cuadro final de la intro de Riffast —trébol blanco
//     respirando sobre verde—, del mismo tamaño y en la misma posición. En la
//     primera carga queda debajo de la intro y la "sostiene" hasta que hay
//     contenido; en cargas posteriores (navegar dentro de la app) se ve sola.
//   fullScreen=false: versión compacta sobre fondo claro (ej. boletera).
export function BrandLoader({
  fullScreen = true,
  className,
}: {
  fullScreen?: boolean;
  className?: string;
}) {
  useIntroHold(fullScreen);

  if (!fullScreen) {
    return (
      <div role="status" aria-label="Cargando" className={cn('grid place-items-center py-14', className)}>
        <div className="relative grid h-12 w-12 place-items-center">
          <img src={cloverUrl} alt="" draggable={false} className="relative h-full w-full select-none object-contain opacity-90" />
          {/* Destello diagonal recortado a la silueta del trébol. */}
          <div aria-hidden className="brand-loader-shine absolute inset-0" style={maskFor(cloverUrl)} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn('brand-loader-in fixed inset-0 z-50 flex items-center justify-center', className)}
      style={{ background: INTRO_BG }}
    >
      {/* Mismo lienzo que el SVG de la intro: ancho clamp(280px, min(72vw,118vh), 780px), 1000:640. */}
      <div
        className="brand-loader-breathe relative"
        style={{ width: 'clamp(280px, min(72vw, 118vh), 780px)', aspectRatio: '1000 / 640' }}
      >
        <div aria-hidden className="absolute bg-white" style={{ ...CLOVER_BOX, ...maskFor(cloverUrl) }} />
      </div>
    </div>
  );
}

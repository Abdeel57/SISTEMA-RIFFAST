import { useId } from 'react';
import { cn } from '@/lib/cn';

// Íconos propios de la barra de pestañas del panel (rejilla de 24 px, esquinas
// redondeadas). Inactivos: línea fina. Activos: la silueta se rellena con el
// degradado «gema» de los cuadros de ícono (ver .rf-gem-tile) y los detalles
// quedan calados en blanco, como los símbolos rellenos de iOS.

export interface TabIconProps {
  active: boolean;
  className?: string;
}

const GEM_TOP = '#19b672';
const GEM_BOTTOM = '#0a8051';

function Glyph({
  active,
  className,
  shape,
  details,
}: TabIconProps & {
  /** Silueta principal (se rellena al activarse). */
  shape: React.ReactNode;
  /** Detalles interiores (líneas, puerta…): trazo en reposo, blanco al activarse. */
  details?: React.ReactNode;
}) {
  const gid = `tab-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(
        'h-[26px] w-[26px] overflow-visible transition-transform duration-fast',
        active && 'drop-shadow-[0_1px_1.5px_rgba(4,73,45,0.3)]',
        className,
      )}
    >
      {active && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GEM_TOP} />
            <stop offset="1" stopColor={GEM_BOTTOM} />
          </linearGradient>
        </defs>
      )}
      <g
        fill={active ? `url(#${gid})` : 'none'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shape}
      </g>
      {details && (
        <g
          fill="none"
          stroke={active ? '#ffffff' : 'currentColor'}
          strokeWidth={active ? 1.8 : 1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {details}
        </g>
      )}
    </svg>
  );
}

// Inicio: casa de techo suave con puerta en arco.
export function TabHomeIcon(props: TabIconProps) {
  return (
    <Glyph
      {...props}
      shape={<path d="M4.25 10.6 11.1 4.9a1.4 1.4 0 0 1 1.8 0l6.85 5.7c.32.27.5.66.5 1.07v7.33a1.75 1.75 0 0 1-1.75 1.75H5.5a1.75 1.75 0 0 1-1.75-1.75v-7.33c0-.41.18-.8.5-1.07Z" />}
      details={<path d="M10 20.5v-4.25a2 2 0 0 1 4 0v4.25" />}
    />
  );
}

// Órdenes: recibo con borde dentado y tres renglones.
export function TabOrdersIcon(props: TabIconProps) {
  return (
    <Glyph
      {...props}
      shape={<path d="M6.25 3.5h11.5c.69 0 1.25.56 1.25 1.25V20.3l-2.33-1.45-2.34 1.45-2.33-1.45-2.33 1.45-2.34-1.45L5 20.3V4.75c0-.69.56-1.25 1.25-1.25Z" />}
      details={<path d="M9 8.5h6M9 12h6M9 15.5h3.5" />}
    />
  );
}

// Rifas: boleto con muescas a los lados y perforación.
export function TabRafflesIcon(props: TabIconProps) {
  return (
    <Glyph
      {...props}
      shape={<path d="M3.75 7.75c0-.97.78-1.75 1.75-1.75h13c.97 0 1.75.78 1.75 1.75v2.1a2.15 2.15 0 0 0 0 4.3v2.1c0 .97-.78 1.75-1.75 1.75h-13c-.97 0-1.75-.78-1.75-1.75v-2.1a2.15 2.15 0 0 0 0-4.3v-2.1Z" />}
      details={<path d="M14.75 7.4v1.3M14.75 11.35v1.3M14.75 15.3v1.3" />}
    />
  );
}

// Una hoja del trébol: cuadro con las esquinas exteriores muy redondeadas y la
// que mira al centro casi recta (las cuatro juntas evocan el trébol de Riffast).
function leaf(x: number, y: number, s: number, inner: 'tl' | 'tr' | 'bl' | 'br'): string {
  const R = 2.7;
  const r = 1.1;
  const [tl, tr, br, bl] = [inner === 'tl' ? r : R, inner === 'tr' ? r : R, inner === 'br' ? r : R, inner === 'bl' ? r : R];
  return [
    `M${x + tl} ${y}`,
    `H${x + s - tr}`,
    `A${tr} ${tr} 0 0 1 ${x + s} ${y + tr}`,
    `V${y + s - br}`,
    `A${br} ${br} 0 0 1 ${x + s - br} ${y + s}`,
    `H${x + bl}`,
    `A${bl} ${bl} 0 0 1 ${x} ${y + s - bl}`,
    `V${y + tl}`,
    `A${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
    'Z',
  ].join(' ');
}

// Más: cuatro hojas en rejilla de 2×2.
export function TabMoreIcon(props: TabIconProps) {
  const s = 6.9;
  const a = 4;
  const b = 20 - s;
  return (
    <Glyph
      {...props}
      shape={
        <>
          <path d={leaf(a, a, s, 'br')} />
          <path d={leaf(b, a, s, 'bl')} />
          <path d={leaf(a, b, s, 'tr')} />
          <path d={leaf(b, b, s, 'tl')} />
        </>
      }
    />
  );
}

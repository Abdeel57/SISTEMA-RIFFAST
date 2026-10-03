import { useMemo } from 'react';
import { qrMatrix } from '@/lib/offline/qr';

interface Props {
  /** Texto a codificar (normalmente la URL de verificación del boleto). */
  value: string;
  /** Tamaño del QR en píxeles (cuadrado). Grande por defecto para tercera edad. */
  size?: number;
  /** Margen claro (módulos) alrededor; 4 es el "quiet zone" estándar. */
  quietZone?: number;
  className?: string;
}

/**
 * Código QR renderizado en SVG, sin dependencias ni red.
 *
 * Funciona 100% offline (el boleto guardado en IndexedDB trae su `verifyUrl`).
 * SVG = nítido a cualquier tamaño y de alto contraste (negro sobre blanco),
 * ideal para escanearlo en el sorteo. Si el texto no se pudiera codificar,
 * no rompe la página: simplemente no muestra el QR.
 */
export function QrCode({ value, size = 220, quietZone = 4, className }: Props) {
  const matrix = useMemo(() => {
    try {
      return qrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  const count = matrix.length;
  const dim = count + quietZone * 2;

  // Un único path con todos los módulos oscuros (eficiente y nítido).
  let d = '';
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (matrix[y][x]) {
        d += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label="Código QR del boleto"
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}

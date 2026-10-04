import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { AuthLayout } from '@/components/layout/AuthLayout';
import cloverUrl from '@/assets/riffast-clover.svg';

// Recorta una capa a la silueta del trébol (igual que BrandLoader). La URL va
// entre comillas: en producción Vite incrusta el SVG como data URI con comillas
// simples, y sin comillas el navegador descarta la máscara (el destello se veía
// en toda la caja de la imagen en vez de solo en el trébol).
function maskFor(url: string): CSSProperties {
  return {
    maskImage: `url("${url}")`,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  };
}

// Figuras que suben por la franja verde y se desvanecen hacia arriba. Valores
// fijos (no aleatorios) para que se vea igual en cada visita: posición (%),
// tamaño (px), duración y retraso negativo (ya van a medio camino al entrar),
// vaivén lateral, giro inicial y opacidad máxima.
interface Floater {
  shape: 'trebol' | 'boleto';
  x: number;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  rot: number;
  op: number;
}

const FLOATERS: Floater[] = [
  { shape: 'trebol', x: 5, size: 22, dur: 19, delay: -2, sway: 16, rot: -12, op: 0.13 },
  { shape: 'boleto', x: 13, size: 30, dur: 23, delay: -14, sway: -14, rot: 14, op: 0.22 },
  { shape: 'trebol', x: 22, size: 16, dur: 16, delay: -7, sway: 12, rot: 18, op: 0.11 },
  { shape: 'boleto', x: 31, size: 26, dur: 21, delay: -3, sway: -16, rot: -16, op: 0.2 },
  { shape: 'trebol', x: 40, size: 28, dur: 25, delay: -18, sway: 14, rot: -6, op: 0.12 },
  { shape: 'trebol', x: 51, size: 14, dur: 17, delay: -11, sway: -10, rot: 26, op: 0.11 },
  { shape: 'boleto', x: 59, size: 28, dur: 22, delay: -8, sway: 16, rot: 10, op: 0.2 },
  { shape: 'trebol', x: 68, size: 20, dur: 18, delay: -15, sway: -12, rot: -20, op: 0.13 },
  { shape: 'boleto', x: 76, size: 24, dur: 24, delay: -1, sway: 12, rot: -8, op: 0.2 },
  { shape: 'trebol', x: 85, size: 26, dur: 20, delay: -9, sway: -18, rot: 12, op: 0.12 },
  { shape: 'trebol', x: 94, size: 16, dur: 16, delay: -5, sway: 10, rot: -24, op: 0.11 },
  { shape: 'boleto', x: 46, size: 22, dur: 27, delay: -21, sway: -12, rot: 6, op: 0.18 },
  { shape: 'trebol', x: 2, size: 18, dur: 26, delay: -12, sway: 14, rot: 20, op: 0.11 },
  { shape: 'boleto', x: 90, size: 30, dur: 28, delay: -19, sway: -16, rot: -12, op: 0.18 },
];

function Ticket() {
  return (
    <svg viewBox="0 0 28 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3.5 0.7H24.5A2.8 2.8 0 0 1 27.3 3.5V5A3 3 0 0 0 27.3 11V12.5A2.8 2.8 0 0 1 24.5 15.3H3.5A2.8 2.8 0 0 1 0.7 12.5V11A3 3 0 0 0 0.7 5V3.5A2.8 2.8 0 0 1 3.5 0.7Z" />
    </svg>
  );
}

function FloatingFigures() {
  const cloverMask = maskFor(cloverUrl);
  return (
    <div className="rf-login-float">
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className="rf-float"
          style={
            {
              '--x': `${f.x}%`,
              '--s': `${f.size}px`,
              '--d': `${f.dur}s`,
              '--delay': `${f.delay}s`,
              '--sway': `${f.sway}px`,
              '--r': `${f.rot}deg`,
              '--o': f.op,
            } as CSSProperties
          }
        >
          {f.shape === 'trebol' ? (
            <span className="rf-float-shape rf-float-clover" style={cloverMask} />
          ) : (
            <span className="rf-float-shape rf-float-ticket">
              <Ticket />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// Marco del inicio de sesión, «el boleto de la suerte» (estilos en login.css):
// franja verde de marca con el logotipo blanco, el sello «Panel del rifero» y
// el lema; el formulario (children) va en el cuerpo de un boleto cuyo talón
// perforado lleva «Ver mi página»; debajo, la ayuda para la primera vez.
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout className="rf-login">
      <div aria-hidden className="rf-login-band">
        <FloatingFigures />
      </div>

      <header className="rf-login-brand">
        <div className="rf-login-logo">
          <Logo tone="light" className="rf-login-logo-img" />
          <span aria-hidden className="rf-login-shine" style={maskFor(cloverUrl)} />
        </div>
        <p className="rf-login-chip">Panel del rifero</p>
        <p className="rf-login-tagline">Tus rifas, órdenes y{' '}boletos en un solo lugar.</p>
      </header>

      <main className="rf-ticket">
        <div className="rf-ticket-body">{children}</div>
        <div className="rf-ticket-stub">
          <Link to="/" className="rf-login-pill rf-login-ring">
            Ver mi página
          </Link>
        </div>
      </main>

      <p className="rf-login-first">
        <strong>¿Primera vez aquí?</strong> Entra con el usuario y la contraseña que te dieron.
      </p>
    </AuthLayout>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { AuthLayout } from '@/components/layout/AuthLayout';
import cloverUrl from '@/assets/riffast-clover.svg';

// Recorta una capa a la silueta del trébol (igual que BrandLoader).
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

// Marco del inicio de sesión, «el boleto de la suerte» (estilos en login.css):
// franja verde de marca con el logotipo blanco, el sello «Panel del rifero» y
// el lema; el formulario (children) va en el cuerpo de un boleto cuyo talón
// perforado lleva «Ver mi página»; debajo, la ayuda para la primera vez.
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout className="rf-login">
      <div aria-hidden className="rf-login-band" />

      <header className="rf-login-brand">
        <div className="rf-login-logo">
          <Logo tone="light" className="rf-login-logo-img" />
          <span aria-hidden className="rf-login-shine" style={maskFor(cloverUrl)} />
        </div>
        <p className="rf-login-chip">Panel del rifero</p>
        <p className="rf-login-tagline">Tus rifas, órdenes y{' '}boletos en un solo lugar.</p>
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

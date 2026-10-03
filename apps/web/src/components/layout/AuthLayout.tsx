import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { SurfaceProvider, ADMIN_SURFACE } from '@/components/ui/surface';

// Layout de autenticación del administrador (estética Apple, pensado para
// celular): fondo gris claro, columna centrada y contenido arriba para que el
// botón siga a la vista con el teclado abierto. Respeta las zonas seguras.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SurfaceProvider value={ADMIN_SURFACE}>
      <div className="rf-admin flex min-h-[100dvh] flex-col">
        <header className="pt-safe">
          <div className="mx-auto flex h-navbar w-full max-w-[440px] items-center px-2 sm:max-w-none sm:px-4">
            <Link
              to="/"
              className="flex h-11 items-center rounded-full pr-2 text-body text-rf-accent outline-none transition-opacity active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.2} />
              Ver mi página
            </Link>
          </div>
        </header>

        <main className="flex flex-1 justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,5vh)] sm:items-center sm:pt-0">
          <div className="w-full max-w-[400px] animate-rf-rise sm:-mt-16">
            <Logo tone="dark" className="h-10" />
            {children}
          </div>
        </main>

        <footer className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-caption text-rf-tertiary">
          Riffast · Panel del rifero
        </footer>
      </div>
    </SurfaceProvider>
  );
}

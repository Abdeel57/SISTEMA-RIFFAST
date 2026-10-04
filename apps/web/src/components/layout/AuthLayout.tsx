import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SurfaceProvider, ADMIN_SURFACE } from '@/components/ui/surface';
import { UpdatePrompt } from '@/components/owner/UpdatePrompt';

// Marco de las pantallas de acceso del administrador (hoy solo /login): les da
// el alcance del panel —`.rf-admin` (estética Apple) y la superficie de admin
// para que los componentes compartidos de components/ui tomen su variante— y el
// aviso «Nueva versión lista». El diseño lo pone cada pantalla (el del login
// vive en pages/auth/LoginShell + login.css); `className` va a la raíz.
export function AuthLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <SurfaceProvider value={ADMIN_SURFACE}>
      <div className={cn('rf-admin', className)}>
        {children}
        <UpdatePrompt />
      </div>
    </SurfaceProvider>
  );
}

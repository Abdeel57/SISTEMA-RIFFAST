import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { PageLoader } from '@/components/ui/misc';
import { IntroHold } from '@/lib/intro';

// Mientras se verifica la sesión (arranque de la app) la intro de Riffast sigue
// en pantalla: así el panel o el login aparecen ya listos, sin pasar por el spinner.
function SessionLoader() {
  return (
    <>
      <IntroHold />
      <PageLoader />
    </>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return <SessionLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

// Acceso al panel: cualquier staff vinculado a un rifero (dueño, admin extra o
// vendedor) o un SUPER_ADMIN. Los vendedores entran pero su navegación queda
// limitada y las rutas de administración están protegidas con <RequireAdmin>.
export function RequireRifero({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return <SessionLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // Debe pertenecer a un rifero (dueño con perfil o staff con membresía).
  if (!user.riferoId && user.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Rutas SOLO para administradores (dueño y admins extra). Un vendedor que llegue
// por URL directa es redirigido a su panel — defensa en el frontend que se suma
// a la del backend (requireRifero bloquea a los vendedores en la API).
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return <SessionLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.role === 'RIFERO' || user.role === 'SUPER_ADMIN';
  if (!isAdmin) return <Navigate to="/admin/inicio" replace />;
  return <>{children}</>;
}

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return <SessionLoader />;
  if (user) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

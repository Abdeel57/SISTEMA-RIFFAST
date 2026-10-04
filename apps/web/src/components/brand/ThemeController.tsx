import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { applyTheme, ADMIN_THEME_COLOR, LOGIN_THEME_COLOR } from '@/store/theme';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"

// Decide y aplica el tema en cada navegación de la SPA (fuente única):
//   - Administrador (/admin, /login) → siempre claro.
//   - Páginas públicas → lo elige el rifero (publicDarkMode), por defecto claro.
// En producción el backend ya inyecta la clase `dark` en el HTML inicial de las
// páginas públicas, así que aquí solo reafirmamos al navegar (y en desarrollo,
// donde no hay HTML inyectado). Comparte la query con usePwaBranding (mismo key).
export function ThemeController(): null {
  const { pathname } = useLocation();
  const isAdmin = pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/');
  const isLogin = pathname === '/login';
  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
  });

  // Marca el documento en las rutas del administrador: el fondo de la página
  // (rebote del scroll en iOS, áreas fuera del panel) toma el gris del panel.
  // En /login además `rf-login-route`: el rebote de arriba sale verde, como la
  // franja de marca (regla en pages/auth/login.css).
  useEffect(() => {
    document.documentElement.classList.toggle('rf-admin-route', isAdmin);
    document.documentElement.classList.toggle('rf-login-route', isLogin);
  }, [isAdmin, isLogin]);

  useEffect(() => {
    if (isAdmin) {
      // El panel impone su color (en /login, el verde de la franja); en público
      // lo decide el rifero (RiferoTheme).
      applyTheme(false, isLogin ? LOGIN_THEME_COLOR : ADMIN_THEME_COLOR);
      return;
    }
    // En público: hasta no conocer el ajuste del rifero, NO tocamos la clase que
    // ya puso el backend (evita el parpadeo claro→oscuro en sitios en oscuro).
    if (data) applyTheme(!!data.rifero?.publicDarkMode);
  }, [isAdmin, isLogin, data]);

  return null;
}

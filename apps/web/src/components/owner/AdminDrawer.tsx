import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  Eye,
  Home,
  Receipt,
  Ticket,
  Menu,
  Palette,
  User,
  Users,
  CreditCard,
  FileBarChart,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/cn';
import { useNotificationsSummary } from '@/lib/pwa/useNotificationsSummary';
import { useAuthStore } from '@/store/auth';
import { LogoMark } from '@/components/brand/LogoMark';
import { IntroHold } from '@/lib/intro';
import { SurfaceProvider } from '@/components/ui/surface';
import { HeaderSlotProvider } from '@/components/owner/AdminChrome';
import { AssistantProvider, AssistantBubble } from '@/components/owner/Assistant';
import { UpdatePrompt } from '@/components/owner/UpdatePrompt';

function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/admin/ordenes')) return 'Órdenes';
  if (pathname.startsWith('/admin/rifas/nueva')) return 'Nueva rifa';
  if (/^\/admin\/rifas\/[^/]+\/editar/.test(pathname)) return 'Editar rifa';
  if (/^\/admin\/rifas\/[^/]+\/boletos/.test(pathname)) return 'Boletos';
  if (/^\/admin\/rifas\/[^/]+\/sorteo/.test(pathname)) return 'Sorteo';
  if (/^\/admin\/rifas\/[^/]+\/promociones/.test(pathname)) return 'Promociones';
  if (pathname.startsWith('/admin/rifas')) return 'Rifas';
  if (pathname.startsWith('/admin/diseno')) return 'Apariencia';
  if (pathname.startsWith('/admin/perfil')) return 'Perfil';
  if (pathname.startsWith('/admin/pagos')) return 'Datos de pago';
  if (pathname.startsWith('/admin/reportes')) return 'Reportes';
  if (pathname.startsWith('/admin/configuracion')) return 'Ajustes';
  if (pathname.startsWith('/admin/usuarios')) return 'Usuarios y Roles';
  if (pathname.startsWith('/admin/mas')) return 'Más';
  if (pathname.startsWith('/admin/inicio')) return 'Inicio';
  return 'Administrador';
}

// ¿La ruta es una sub-pantalla de una rifa (crear/editar/boletos/sorteo/promos)?
// Estas tienen "atrás" a la lista de rifas en TODOS los tamaños.
function raffleBackTarget(pathname: string): string | null {
  if (
    pathname.startsWith('/admin/rifas/nueva') ||
    /^\/admin\/rifas\/[^/]+\/(editar|boletos|sorteo|promociones)/.test(pathname)
  ) {
    return '/admin/rifas';
  }
  return null;
}

// Secciones que en MÓVIL se abren desde el hub "Más" (atrás → /admin/mas).
// En escritorio son ítems de primer nivel del sidebar (sin "atrás").
function moreBackTarget(pathname: string): string | null {
  const fromMore = ['diseno', 'perfil', 'pagos', 'reportes', 'configuracion', 'usuarios'];
  if (fromMore.some((s) => pathname.startsWith(`/admin/${s}`))) return '/admin/mas';
  return null;
}

// ── Navegación del sidebar (escritorio) ──────────────────────
interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { to: '/admin/inicio', label: 'Inicio', icon: Home },
      { to: '/admin/ordenes', label: 'Órdenes', icon: Receipt, badge: true },
      { to: '/admin/rifas', label: 'Rifas', icon: Ticket },
    ],
  },
  {
    label: 'Tu página',
    items: [
      { to: '/admin/diseno', label: 'Apariencia', icon: Palette },
      { to: '/admin/perfil', label: 'Perfil', icon: User },
      { to: '/admin/pagos', label: 'Datos de pago', icon: CreditCard },
    ],
  },
  {
    label: 'Tu negocio',
    items: [
      { to: '/admin/reportes', label: 'Reportes', icon: FileBarChart },
      { to: '/admin/usuarios', label: 'Usuarios y Roles', icon: Users },
      { to: '/admin/configuracion', label: 'Ajustes', icon: Settings },
    ],
  },
];

// Navegación reducida para vendedores: solo su panel y sus ventas.
const SELLER_NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Vendedor',
    items: [
      { to: '/admin/inicio', label: 'Mi panel', icon: Home },
      { to: '/admin/ordenes', label: 'Mis ventas', icon: Receipt, badge: true },
    ],
  },
];

// ¿Está activo este ítem para la ruta actual? (cubre sus sub-rutas)
function isNavActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rf-danger px-1 text-caption font-semibold leading-none text-white tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ¿Pantalla de escritorio? (la burbuja reserva menos espacio sin barra inferior)
function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return match;
}

// Sidebar de escritorio (lg+): navegación completa, sin tabs inferiores.
function DesktopSidebar({
  pathname,
  pendingTotal,
  groups,
  subtitle,
  showViewPage,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  pendingTotal: number;
  groups: { label: string; items: NavItem[] }[];
  subtitle: string;
  showViewPage: boolean;
  onNavigate: (to: string) => void;
  onLogout: () => void;
}) {
  const itemClass = 'rf-row flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-callout outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45';
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-rf-separator bg-rf-surface lg:flex">
      {/* Marca */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <LogoMark className="h-8 w-8" />
        <div className="min-w-0 leading-tight">
          <p className="text-body font-semibold">Riffast</p>
          <p className="text-caption text-rf-secondary">{subtitle}</p>
        </div>
      </div>

      {/* Navegación */}
      <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="pt-4">
            <p className="px-3 pb-1.5 text-caption font-semibold text-rf-secondary">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.to);
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => onNavigate(item.to)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      itemClass,
                      active ? 'bg-rf-accent/10 font-semibold text-rf-accent hover:bg-rf-accent/10' : 'font-medium text-rf-label',
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5 shrink-0', active ? 'text-rf-accent' : 'text-rf-secondary')}
                      strokeWidth={active ? 2.3 : 1.9}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && <CountBadge count={pendingTotal} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie: ver página pública + cerrar sesión */}
      <div className="shrink-0 space-y-0.5 border-t border-rf-separator p-3">
        {showViewPage && (
          <button type="button" onClick={() => onNavigate('/')} className={cn(itemClass, 'font-medium text-rf-label')}>
            <Eye className="h-5 w-5 shrink-0 text-rf-secondary" strokeWidth={1.9} />
            Ver mi página
          </button>
        )}
        <button type="button" onClick={onLogout} className={cn(itemClass, 'font-medium text-rf-danger')}>
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.9} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// Pestaña de la barra inferior (estilo iOS): ícono + texto, verde si está activa.
function Tab({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-tabbar min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pt-1 outline-none transition-opacity duration-fast active:opacity-50 focus-visible:bg-rf-fill',
        active ? 'text-rf-accent' : 'text-rf-secondary',
      )}
    >
      <span className="relative">
        <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.8} />
        {badge !== undefined && <CountBadge count={badge} className="absolute -right-3 -top-1.5 ring-2 ring-white" />}
      </span>
      <span className={cn('max-w-full truncate px-1 text-caption leading-none', active ? 'font-semibold' : 'font-medium')}>
        {label}
      </span>
    </button>
  );
}

export function AdminDrawer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { total: pendingTotal } = useNotificationsSummary();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.user?.role);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  // Raíz del panel: los diálogos y hojas se montan aquí para heredar sus tokens.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const surface = useMemo(() => ({ kind: 'admin' as const, container: root }), [root]);
  // Hueco de la barra superior para la acción de cada pantalla.
  const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null);
  // Título grande → al hacer scroll se reduce al título de la barra.
  const [collapsed, setCollapsed] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Los vendedores ven un panel reducido (solo su panel y sus ventas).
  const isSeller = role === 'SELLER';
  const title = sectionTitle(location.pathname);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const raffleBack = raffleBackTarget(location.pathname);
  const moreBack = moreBackTarget(location.pathname);
  // En móvil cualquier sub-pantalla (rifa o sección de "Más") oculta los tabs.
  const isSubScreen = raffleBack !== null || moreBack !== null;

  // Cerrar con Escape (escritorio) + bloquear scroll del fondo (la página pública
  // queda detrás del panel; su scroll no debe filtrarse). Si hay un diálogo
  // abierto, Escape solo cierra el diálogo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      navigate('/');
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Título grande que se reduce: pasado el título, la barra muestra el título
  // compacto y una línea fina. Un solo listener pasivo + rAF (barato).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCollapsed(el.scrollTop > 40));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Al cambiar de pantalla, empezar arriba (evita aterrizar a media lista).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setCollapsed(false);
  }, [location.pathname]);

  const onInicio = location.pathname.startsWith('/admin/inicio');
  const onOrdenes = location.pathname.startsWith('/admin/ordenes');
  const onRifas = location.pathname.startsWith('/admin/rifas');
  const masActive = !onInicio && !onOrdenes && !onRifas;

  // Espacio que la burbuja de Asistencia deja libre abajo: la barra de
  // pestañas (49 px) o la barra de guardar de las sub-pantallas.
  const bubbleReserve = isDesktop ? 24 : isSubScreen ? 96 : 49 + 12;

  const backButton = raffleBack ? (
    <BackButton label="Rifas" onClick={() => navigate(raffleBack)} />
  ) : moreBack ? (
    // Las secciones de "Más" solo necesitan "atrás" en móvil (en escritorio
    // están en el sidebar).
    <BackButton label="Más" onClick={() => navigate(moreBack)} className="lg:hidden" />
  ) : null;

  return (
    <SurfaceProvider value={surface}>
      <AssistantProvider>
        <div ref={setRoot} className="rf-admin fixed inset-0 z-50 flex">
          {/* Backdrop sólo en tablet (sm–md): deja ver la página detrás, click cierra.
              En escritorio (lg+) hay sidebar, así que no aplica. */}
          <button
            aria-label="Cerrar administrador"
            onClick={() => navigate('/')}
            className="hidden flex-1 cursor-default bg-black/30 animate-rf-fade-in sm:block lg:hidden"
          />

          {/* Sidebar de escritorio */}
          <DesktopSidebar
            pathname={location.pathname}
            pendingTotal={pendingTotal}
            groups={isSeller ? SELLER_NAV_GROUPS : NAV_GROUPS}
            subtitle={isSeller ? 'Vendedor' : 'Administrador'}
            showViewPage={!isSeller}
            onNavigate={navigate}
            onLogout={() => setConfirmLogout(true)}
          />

          {/* Columna principal: pantalla completa en móvil, panel lateral en
              tablet y columna de contenido en escritorio. */}
          <section className="relative flex h-full w-full min-w-0 flex-col bg-rf-bg sm:max-w-lg sm:animate-slide-in-right sm:shadow-float lg:max-w-none lg:flex-1 lg:animate-none lg:shadow-none">
            {/* Barra superior: atrás + título compacto (al hacer scroll) + acción */}
            <header
              className={cn(
                'relative z-20 shrink-0 border-b pt-safe transition-colors duration-base',
                collapsed ? 'border-rf-separator bg-rf-bg/95' : 'border-transparent bg-rf-bg',
              )}
            >
              <div className="relative mx-auto flex h-navbar max-w-[960px] items-center gap-2 px-2 lg:px-6">
                <div className="flex min-w-0 flex-1 items-center">{backButton}</div>
                <p
                  aria-hidden={!collapsed}
                  className={cn(
                    'pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-body font-semibold text-rf-label transition-opacity duration-base',
                    collapsed ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {title}
                </p>
                <div ref={setActionSlot} className="flex min-w-0 flex-1 items-center justify-end gap-1" />
                {/* Vendedores: no tienen «Más», así que salen desde aquí (en
                    escritorio está en el sidebar). */}
                {isSeller && (
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-body font-semibold text-rf-danger outline-none active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45 lg:hidden"
                  >
                    <LogOut className="h-5 w-5" />
                    Salir
                  </button>
                )}
              </div>
            </header>

            {/* Contenido. El padding vive en el wrapper interior (NO en el scroller):
                el padding del scroller desplaza el anclaje de los elementos sticky. */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
              <div
                className={cn(
                  'mx-auto w-full max-w-[960px] px-gutter lg:px-8',
                  // En sub-pantallas móviles no hay tabs: respetar el home indicator.
                  isSubScreen ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'pb-24',
                  'lg:pb-16',
                )}
              >
                <HeaderSlotProvider value={actionSlot}>
                  {/* Título grande: se va con el scroll y queda el compacto arriba. */}
                  <h1 className="pb-3 pt-0.5 text-title text-rf-label lg:pt-4">{title}</h1>
                  {/* En la primera carga del panel, la intro espera también a la sección. */}
                  <Suspense
                    fallback={
                      <>
                        <IntroHold />
                        <PageLoader />
                      </>
                    }
                  >
                    <Outlet />
                  </Suspense>
                </HeaderSlotProvider>
              </div>
            </div>

            {/* Barra de pestañas (sólo móvil/tablet). Se oculta en sub-pantallas y en
                escritorio (que usa el sidebar). El vendedor ve solo su panel y ventas. */}
            {!isSubScreen && (
              <nav
                aria-label="Secciones"
                className="relative z-20 flex shrink-0 border-t border-rf-separator bg-[rgba(250,250,252,0.97)] pb-safe lg:hidden"
              >
                {isSeller ? (
                  <>
                    <Tab label="Mi panel" icon={Home} active={onInicio} onClick={() => navigate('/admin/inicio')} />
                    <Tab label="Mis ventas" icon={Receipt} active={onOrdenes} badge={pendingTotal} onClick={() => navigate('/admin/ordenes')} />
                  </>
                ) : (
                  <>
                    <Tab label="Inicio" icon={Home} active={onInicio} onClick={() => navigate('/admin/inicio')} />
                    <Tab label="Órdenes" icon={Receipt} active={onOrdenes} badge={pendingTotal} onClick={() => navigate('/admin/ordenes')} />
                    <Tab label="Rifas" icon={Ticket} active={onRifas} onClick={() => navigate('/admin/rifas')} />
                    <Tab label="Más" icon={Menu} active={masActive} onClick={() => navigate('/admin/mas')} />
                  </>
                )}
              </nav>
            )}

            {/* Asistencia 24 h: burbuja flotante y arrastrable, nunca sobre la barra. */}
            <AssistantBubble reserve={bubbleReserve} />
          </section>

          {/* «Hay una versión nueva · Actualizar» (PWA). */}
          <UpdatePrompt />

          <ConfirmDialog
            open={confirmLogout}
            onOpenChange={setConfirmLogout}
            title="¿Cerrar sesión?"
            description="Para volver a entrar tendrás que escribir tu usuario y contraseña."
            confirmLabel="Cerrar sesión"
            destructive
            loading={loggingOut}
            onConfirm={() => void handleLogout()}
          />
        </div>
      </AssistantProvider>
    </SurfaceProvider>
  );
}

function BackButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-ml-1 flex h-11 min-w-0 items-center rounded-full pr-2 text-body text-rf-accent outline-none transition-opacity active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45',
        className,
      )}
    >
      <ChevronLeft className="h-7 w-7 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{label}</span>
    </button>
  );
}

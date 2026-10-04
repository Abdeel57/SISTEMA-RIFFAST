import type { ReactNode } from 'react';

// Pasos del tutorial del administrador. `target` = valor de data-tour del
// elemento a iluminar (pestaña, fila del menú, botón). `route` = pantalla donde
// vive ese elemento (en celular las secciones de «Más» viven en /admin/mas; en
// computadora están siempre en el menú lateral).

export type StepKind = 'welcome' | 'spotlight' | 'practice' | 'final';

export interface TourStep {
  id: string;
  kind: StepKind;
  title: string;
  body: ReactNode;
  target?: string;
  route?: { mobile?: string; desktop?: string };
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-rf-label">{children}</strong>;

const FINAL: TourStep = {
  id: 'asistente',
  kind: 'final',
  target: 'asistente',
  title: '¿Dudas? Te ayudamos las 24 horas',
  body: (
    <>
      Si tienes dudas o problemas para realizar cualquier acción, entra al <B>asistente</B>: está disponible las 24
      horas para cualquier cosa o consulta. También puede hacer cambios por ti, siempre con tu confirmación.
    </>
  ),
};

export const ADMIN_STEPS: TourStep[] = [
  { id: 'bienvenida', kind: 'welcome', title: 'Tu administrador en 1 minuto', body: null },
  {
    id: 'inicio',
    kind: 'spotlight',
    target: 'nav-inicio',
    route: { mobile: '/admin/inicio', desktop: '/admin/inicio' },
    title: 'Inicio: tu negocio de un vistazo',
    body: (
      <>
        Aquí ves tus <B>Ingresos</B>, los boletos <B>Vendidos</B> y lo que tienes <B>Pendiente</B> de cobrar. También
        encuentras tus <B>Primeros pasos</B> y el botón para compartir tu link de venta.
      </>
    ),
  },
  {
    id: 'rifas',
    kind: 'spotlight',
    target: 'nueva-rifa',
    route: { mobile: '/admin/rifas', desktop: '/admin/rifas' },
    title: 'Crea una rifa',
    body: (
      <>
        Toca <B>Nueva rifa</B> y completa 4 pasos: <B>Tu rifa</B>, <B>Boletos y precio</B>, <B>Imágenes del premio</B> y{' '}
        <B>Sorteo y pago</B>. Se guarda como borrador; cuando esté lista, toca <B>Publicar ahora</B>.
      </>
    ),
  },
  {
    id: 'ordenes',
    kind: 'spotlight',
    target: 'nav-ordenes',
    route: { mobile: '/admin/ordenes', desktop: '/admin/ordenes' },
    title: 'Órdenes: apartados y pagos',
    body: (
      <>
        Cada vez que alguien aparta boletos, su orden llega a <B>Pendientes</B>. Cuando te paga, la confirmas y le envías
        su boleto digital. Practiquemos con una orden de ejemplo.
      </>
    ),
  },
  {
    id: 'practica',
    kind: 'practice',
    route: { mobile: '/admin/ordenes', desktop: '/admin/ordenes' },
    title: 'Confirma un pago',
    body: null,
  },
  {
    id: 'pagos',
    kind: 'spotlight',
    target: 'nav-pagos',
    route: { mobile: '/admin/mas' },
    title: 'Datos de pago',
    body: (
      <>
        En <B>Datos de pago</B> agregas tu banco, CLABE o tarjeta. Es lo que ven tus compradores para pagarte, y el dinero
        llega directo a tu cuenta.
      </>
    ),
  },
  {
    id: 'usuarios',
    kind: 'spotlight',
    target: 'nav-usuarios',
    route: { mobile: '/admin/mas' },
    title: 'Tu equipo',
    body: (
      <>
        En <B>Usuarios y Roles</B> das acceso a otros administradores o a vendedores. Cada vendedor tiene su propio link
        de venta y ves cuánto vende cada uno.
      </>
    ),
  },
  {
    id: 'pagina',
    kind: 'spotlight',
    target: 'nav-diseno',
    route: { mobile: '/admin/mas' },
    title: 'Tu página, a tu estilo',
    body: (
      <>
        En <B>Apariencia</B> pones tu logo, colores y portada; en <B>Perfil</B>, tu WhatsApp y redes. En <B>Ajustes</B>{' '}
        decides cuánto dura un apartado y activas los avisos en tu celular.
      </>
    ),
  },
  FINAL,
];

export const SELLER_STEPS: TourStep[] = [
  { id: 'bienvenida', kind: 'welcome', title: 'Tu panel de vendedor en 1 minuto', body: null },
  {
    id: 'inicio',
    kind: 'spotlight',
    target: 'nav-inicio',
    route: { mobile: '/admin/inicio', desktop: '/admin/inicio' },
    title: 'Tu link de venta',
    body: (
      <>
        En <B>Mi panel</B> está tu link: compártelo por WhatsApp y redes. Todo lo que se compre con él queda a tu nombre, y
        aquí ves cuánto llevas vendido.
      </>
    ),
  },
  {
    id: 'ordenes',
    kind: 'spotlight',
    target: 'nav-ordenes',
    route: { mobile: '/admin/ordenes', desktop: '/admin/ordenes' },
    title: 'Mis ventas',
    body: (
      <>
        Aquí llegan los apartados hechos con tu link. Cuando te paguen, los confirmas desde aquí. Practiquemos con una
        orden de ejemplo.
      </>
    ),
  },
  {
    id: 'practica',
    kind: 'practice',
    route: { mobile: '/admin/ordenes', desktop: '/admin/ordenes' },
    title: 'Confirma un pago',
    body: null,
  },
  FINAL,
];

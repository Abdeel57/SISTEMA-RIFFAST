import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Eye, FileBarChart, Megaphone, CalendarClock, Check } from 'lucide-react';
import { formatMXN } from '@riffast/shared';
import { raffleService } from '@/services/raffles';
import { riferoService } from '@/services/riferos';
import { useAuthStore } from '@/store/auth';
import { buildRiferoShareUrl } from '@/lib/site';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useIntroHold } from '@/lib/intro';
import { PANEL_CARD } from '@/components/owner/PanelKit';
import { ListGroup, ListRow } from '@/components/owner/List';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const SHARED_KEY = 'bsk-shared-page';

// Número clave del resumen: grande, en negrita y con su etiqueta debajo.
function Metric({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  to?: string;
  tone?: 'warning';
}) {
  const inner = (
    <>
      <p className={cn('text-heading tabular-nums', tone === 'warning' ? 'text-rf-warning' : 'text-rf-label')}>{value}</p>
      <p className="mt-0.5 truncate text-caption text-rf-secondary">{label}</p>
    </>
  );
  // La celda lleva el separador; el enlace va dentro para que su redondeo al
  // presionar no curve la línea.
  return (
    <div className="min-w-0 px-1">
      {to ? (
        <Link
          to={to}
          className="rf-press block rounded-control px-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45"
        >
          {inner}
        </Link>
      ) : (
        <div className="px-2 py-2.5">{inner}</div>
      )}
    </div>
  );
}

// Paso de "Primeros pasos": número (o palomita si ya está) a la izquierda.
function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-callout font-semibold',
        done ? 'bg-rf-accent text-white' : 'bg-rf-accent/10 text-rf-accent',
      )}
    >
      {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : n}
    </span>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? 'rifero';
  const [shared, setShared] = useState(() => {
    try {
      return !!localStorage.getItem(SHARED_KEY);
    } catch {
      return false;
    }
  });

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: raffleService.dashboardSummary,
  });
  // Al entrar al panel, la intro de Riffast espera a que las métricas estén listas.
  useIntroHold(summaryQuery.isLoading);

  const profileQuery = useQuery({
    queryKey: ['rifero-me'],
    queryFn: riferoService.me,
  });

  const rafflesQuery = useQuery({
    queryKey: ['raffles'],
    queryFn: () => raffleService.list(),
  });

  const summary = summaryQuery.data?.summary;
  const profile = profileQuery.data?.profile;
  const raffles = rafflesQuery.data?.items ?? [];

  // Estado de los primeros pasos
  const hasPayment = (profile?.paymentMethods?.length ?? 0) > 0;
  const hasRaffle = raffles.length > 0;
  const hasPublished = raffles.some((r) => r.status === 'PUBLISHED' || r.status === 'FINISHED');
  const allDone = hasPayment && hasRaffle && hasPublished && shared;
  const setupLoaded = !profileQuery.isLoading && !rafflesQuery.isLoading;
  const doneCount = [hasPayment, hasRaffle, hasPublished, shared].filter(Boolean).length;

  const sharePage = () => {
    if (!profile) return;
    const url = buildRiferoShareUrl(profile.slug);
    const finish = () => {
      try {
        localStorage.setItem(SHARED_KEY, '1');
      } catch {
        /* noop */
      }
      setShared(true);
    };
    if (navigator.share) {
      navigator
        .share({ title: profile.publicName, text: `Participa en mis rifas: ${url}`, url })
        .then(finish)
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.success('Link copiado. ¡Pégalo en tus redes o WhatsApp!');
        finish();
      })
      .catch(() => toast.error('No se pudo copiar el link'));
  };

  const pending = summary?.pendingOrders ?? 0;

  return (
    <div>
      <p className="-mt-1 mb-5 text-callout text-rf-secondary">Hola, {firstName}. Este es el resumen de tus rifas.</p>

      {/* ── Números clave: lo primero que se busca ── */}
      {summaryQuery.isError ? (
        <div className={PANEL_CARD}>
          <ErrorState
            title="No pudimos cargar tus números"
            onRetry={() => void summaryQuery.refetch()}
            retrying={summaryQuery.isFetching}
          />
        </div>
      ) : summaryQuery.isLoading ? (
        <div className={cn(PANEL_CARD, 'p-5')} role="status" aria-label="Cargando tus números">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-10 w-44" />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      ) : (
        <div className={cn(PANEL_CARD, 'animate-rf-rise overflow-hidden')}>
          <div className="px-5 pb-4 pt-5">
            <p className="text-callout font-medium text-rf-secondary">Ingresos</p>
            <p className="mt-0.5 text-title tabular-nums text-rf-label">{formatMXN(summary?.estimatedRevenue ?? 0)}</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-rf-separator border-t border-rf-separator px-2 py-1.5">
            <Metric label="Vendidos" value={(summary?.soldTickets ?? 0).toLocaleString('es-MX')} />
            <Metric
              label="Pendientes"
              value={pending.toLocaleString('es-MX')}
              to="/admin/ordenes/pendientes"
              tone={pending > 0 ? 'warning' : undefined}
            />
            <Metric label="Pagadas" value={(summary?.paidOrders ?? 0).toLocaleString('es-MX')} to="/admin/ordenes/pagadas" />
          </div>
        </div>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          {/* ── Tus rifas ── */}
          {!summaryQuery.isError && (
            <ListGroup header="Tus rifas">
              <ListRow
                icon={Megaphone}
                title="Rifas activas"
                value={summaryQuery.isLoading ? '–' : (summary?.activeRaffles ?? 0)}
                to="/admin/rifas"
              />
              <ListRow
                icon={CalendarClock}
                title="Sorteos"
                value={summaryQuery.isLoading ? '–' : (summary?.upcomingDraws ?? 0)}
                to="/admin/rifas"
              />
            </ListGroup>
          )}

          {/* ── Primeros pasos (desaparece al completarse) ── */}
          {setupLoaded && !allDone && (
            <ListGroup header={`Primeros pasos · ${doneCount} de 4`}>
              <ListRow
                leading={<StepBadge n={1} done={hasPayment} />}
                title="Configura tus datos de pago"
                subtitle={hasPayment ? undefined : 'A qué cuenta te pagan tus compradores.'}
                {...(hasPayment ? {} : { to: '/admin/pagos' })}
              />
              <ListRow
                leading={<StepBadge n={2} done={hasRaffle} />}
                title="Crea tu primera rifa"
                subtitle={hasRaffle ? undefined : 'Premio, boletos, precio y fecha del sorteo.'}
                {...(hasRaffle ? {} : { to: '/admin/rifas/nueva' })}
              />
              <ListRow
                leading={<StepBadge n={3} done={hasPublished} />}
                title="Publícala"
                subtitle={hasPublished ? undefined : 'Hazla visible para tus compradores.'}
                {...(hasPublished ? {} : { to: '/admin/rifas' })}
              />
              <ListRow
                leading={<StepBadge n={4} done={shared} />}
                title="Comparte tu link"
                subtitle={shared ? undefined : 'Mándalo por WhatsApp o súbelo a tus redes.'}
                {...(shared ? {} : { onClick: sharePage })}
              />
            </ListGroup>
          )}
        </div>

        {/* ── Accesos rápidos ── */}
        <ListGroup header="Accesos rápidos">
          <ListRow icon={Plus} title="Nueva rifa" onClick={() => navigate('/admin/rifas/nueva')} />
          <ListRow icon={Receipt} title="Órdenes" to="/admin/ordenes" />
          <ListRow icon={Eye} iconTone="neutral" title="Ver mi página" to="/" />
          <ListRow icon={FileBarChart} iconTone="neutral" title="Reportes" to="/admin/reportes" />
        </ListGroup>
      </div>
    </div>
  );
}

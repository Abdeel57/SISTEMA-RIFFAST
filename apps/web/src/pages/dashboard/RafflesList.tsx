import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Clock,
  MoreHorizontal,
  Pencil,
  Ticket,
  Trophy,
  Megaphone,
  ExternalLink,
  Share2,
  Send,
} from 'lucide-react';
import {
  RAFFLE_STATUS_LABELS,
  formatMXN,
  formatDateMX,
  type RaffleDTO,
  type RaffleStatus,
} from '@riffast/shared';
import { raffleService } from '@/services/raffles';
import { riferoService } from '@/services/riferos';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { buildRaffleUrl, buildRaffleShareUrl } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/misc';
import { PanelIntro, PANEL_CARD, ProgressBar, IconButton } from '@/components/owner/PanelKit';
import { HeaderAction } from '@/components/owner/AdminChrome';
import { ActionSheet, type SheetAction } from '@/components/owner/ActionSheet';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

// Estado de la rifa sobre la foto: píldora sólida para leerse sobre cualquier imagen.
const STATUS_STYLE: Record<RaffleStatus, string> = {
  DRAFT: 'bg-white/95 text-rf-secondary',
  PUBLISHED: 'bg-rf-accent text-white',
  FINISHED: 'bg-white/95 text-rf-info',
  CANCELLED: 'bg-white/95 text-rf-danger',
};

function RaffleCard({ raffle, slug }: { raffle: RaffleDTO; slug?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Compartir el link público de la rifa (nativo en móvil, copiar en desktop).
  const share = () => {
    if (!slug) return;
    const url = buildRaffleShareUrl(slug, raffle.eventNumber);
    if (navigator.share) {
      void navigator
        .share({ title: raffle.title, text: `Participa en mi rifa "${raffle.title}": ${url}`, url })
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link de la rifa copiado. ¡Compártelo!'))
      .catch(() => toast.error('No se pudo copiar el link'));
  };

  const publish = useMutation({
    mutationFn: () => raffleService.publish(raffle.id),
    onSuccess: () => {
      toast.success('Rifa publicada. Ya está visible para tus compradores.');
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) {
        toast.error(e.message, { description: 'Activa un plan para publicar tus rifas.' });
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'No se pudo publicar la rifa');
    },
  });

  // Mostrar/ocultar la rifa en la página pública (sin cancelarla).
  const visibility = useMutation({
    mutationFn: (hidden: boolean) => raffleService.update(raffle.id, { hidden }),
    onSuccess: (_res, hidden) => {
      toast.success(hidden ? 'Rifa oculta de la página pública.' : 'Rifa visible en la página pública.');
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo cambiar la visibilidad'),
  });

  const remove = useMutation({
    mutationFn: () => raffleService.remove(raffle.id),
    onSuccess: () => {
      toast.success('Rifa eliminada.');
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar la rifa'),
  });

  const sold = raffle.soldCount;
  const total = raffle.totalTickets;
  const progress = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const cover = raffle.images[0]?.url;
  const canToggleVisibility = raffle.status !== 'DRAFT' && raffle.status !== 'CANCELLED';

  const sheetActions: SheetAction[] = [
    { label: 'Editar rifa', icon: Pencil, onSelect: () => navigate(`/admin/rifas/${raffle.id}/editar`) },
    { label: 'Sorteo', icon: Trophy, onSelect: () => navigate(`/admin/rifas/${raffle.id}/sorteo`) },
    { label: 'Promociones', icon: Megaphone, onSelect: () => navigate(`/admin/rifas/${raffle.id}/promociones`) },
    {
      label: 'Ver resultado público',
      icon: ExternalLink,
      href: slug ? buildRaffleUrl(slug, raffle.eventNumber) : undefined,
      external: true,
      hidden: raffle.status !== 'FINISHED' || !slug,
    },
    {
      label: raffle.hidden ? 'Mostrar en la página' : 'Ocultar de la página',
      icon: raffle.hidden ? Eye : EyeOff,
      onSelect: () => visibility.mutate(!raffle.hidden),
      hidden: !canToggleVisibility,
    },
    { label: 'Eliminar rifa', icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(true) },
  ];

  // Acción del estado: publicar el borrador o compartir la publicada.
  const stateAction =
    raffle.status === 'DRAFT' ? (
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        loading={publish.isPending}
        loadingText="Publicando…"
        onClick={() => publish.mutate()}
      >
        <Send className="h-[18px] w-[18px]" /> Publicar
      </Button>
    ) : raffle.status === 'PUBLISHED' && slug ? (
      <Button variant="secondary" size="sm" className="flex-1" onClick={share}>
        <Share2 className="h-[18px] w-[18px]" /> Compartir
      </Button>
    ) : null;

  return (
    <article className={cn(PANEL_CARD, 'overflow-hidden')}>
      {/* Foto del premio con el evento y el estado encima */}
      <button
        type="button"
        onClick={() => navigate(`/admin/rifas/${raffle.id}/editar`)}
        aria-label={`Editar ${raffle.title}`}
        className="relative block aspect-[2/1] w-full bg-rf-fill-strong outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rf-accent/45"
      >
        {cover ? (
          <img src={apiAssetUrl(cover)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-rf-tertiary">
            <ImageIcon className="h-9 w-9" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold tabular-nums text-rf-label shadow-card">
          {raffle.eventLabel}
        </span>
        <span className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <span className={cn('rounded-full px-2.5 py-1 text-caption font-semibold shadow-card', STATUS_STYLE[raffle.status])}>
            {RAFFLE_STATUS_LABELS[raffle.status]}
          </span>
          {raffle.comingSoon && raffle.status === 'PUBLISHED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-rf-warning shadow-card">
              <Clock className="h-3.5 w-3.5" /> Próximamente
            </span>
          )}
          {raffle.hidden && raffle.status !== 'DRAFT' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-rf-secondary shadow-card">
              <EyeOff className="h-3.5 w-3.5" /> Oculta
            </span>
          )}
        </span>
      </button>

      <div className="p-4">
        <h3 className="text-body font-semibold leading-snug text-rf-label">{raffle.title}</h3>
        {raffle.prize && <p className="mt-0.5 line-clamp-1 text-callout text-rf-secondary">Premio: {raffle.prize}</p>}

        {/* Números clave: vendidos e ingresos */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-heading tabular-nums text-rf-label">
              {sold.toLocaleString('es-MX')}
              <span className="text-callout font-normal text-rf-secondary"> de {total.toLocaleString('es-MX')}</span>
            </p>
            <p className="text-caption text-rf-secondary">boletos vendidos · {progress}%</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-heading tabular-nums text-rf-accent">{formatMXN(raffle.estimatedRevenue)}</p>
            <p className="text-caption text-rf-secondary">{formatMXN(raffle.ticketPrice)} por boleto</p>
          </div>
        </div>
        <div className="mt-2.5">
          <ProgressBar value={progress} />
        </div>
        {raffle.drawDate && (
          <p className="mt-2.5 text-caption text-rf-secondary">Sorteo: {formatDateMX(raffle.drawDate)}</p>
        )}

        {/* Acciones: las frecuentes a la vista, el resto en «⋯». */}
        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => navigate(`/admin/rifas/${raffle.id}/boletos`)}>
            <Ticket className="h-[18px] w-[18px]" /> Boletos
          </Button>
          {stateAction}
          <IconButton icon={MoreHorizontal} label="Más acciones" onClick={() => setMenuOpen(true)} />
        </div>
      </div>

      <ActionSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={raffle.title}
        description={`${raffle.eventLabel} · ${RAFFLE_STATUS_LABELS[raffle.status]}`}
        actions={sheetActions}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar esta rifa?"
        description={
          <>
            Se eliminará <span className="font-semibold text-rf-label">{raffle.title}</span> ({raffle.eventLabel}) junto
            con <span className="font-semibold text-rf-label">todas sus órdenes, pagos, boletos, ganador, imágenes y promociones</span>.
            Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, eliminar"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </article>
  );
}

export default function RafflesList() {
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['raffles'],
    queryFn: () => raffleService.list(),
  });
  const profileQ = useQuery({ queryKey: ['rifero', 'me'], queryFn: () => riferoService.me() });
  const slug = profileQ.data?.profile.slug;

  const raffles = data?.items ?? [];

  return (
    <div>
      <HeaderAction label="Nueva rifa" icon={Plus} onClick={() => navigate('/admin/rifas/nueva')} />
      <PanelIntro description="Crea, publica y administra tus sorteos." />

      {isLoading ? (
        <PageLoader label="Cargando tus rifas..." />
      ) : isError ? (
        <ErrorState
          title="No pudimos cargar tus rifas"
          description={error instanceof ApiError ? error.message : undefined}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : raffles.length === 0 ? (
        <EmptyState
          icon={<Ticket />}
          title="Aún no tienes rifas"
          description="Crea tu primera rifa y empieza a vender boletos en minutos."
          action={
            <Button onClick={() => navigate('/admin/rifas/nueva')}>
              <Plus className="h-5 w-5" /> Crear rifa
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {raffles.map((raffle) => (
            <RaffleCard key={raffle.id} raffle={raffle} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2, Receipt, GraduationCap } from 'lucide-react';
import { useAdminTour } from '@/components/owner/tour/AdminTour';
import { formatMXN } from '@riffast/shared';
import { userService } from '@/services/users';
import { useAuthStore } from '@/store/auth';
import { buildSellerHomeUrl } from '@/lib/site';
import { copyToClipboard } from '@/lib/clipboard';
import { PANEL_CARD } from '@/components/owner/PanelKit';
import { ListGroup, ListRow } from '@/components/owner/List';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useIntroHold } from '@/lib/intro';
import { cn } from '@/lib/cn';

// Panel del vendedor: su link de venta y los números de SUS ventas.
export default function SellerHome() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { startTour } = useAdminTour();
  const link = user?.sellerCode ? buildSellerHomeUrl(user.sellerCode) : null;

  const statsQuery = useQuery({ queryKey: ['seller-stats'], queryFn: () => userService.myStats() });
  const s = statsQuery.data?.stats;
  // Al entrar al panel, la intro de Riffast espera a que las métricas estén listas.
  useIntroHold(statsQuery.isLoading);

  const shareLink = () => {
    if (!link) return;
    if (navigator.share) {
      void navigator.share({ title: 'Compra tus boletos', url: link }).catch(() => {});
      return;
    }
    void copyToClipboard(link, 'Link copiado');
  };

  return (
    <div>
      <p className="-mt-1 mb-5 text-callout text-rf-secondary">
        Hola, {user?.name?.split(' ')[0] ?? 'vendedor'}. Comparte tu link y cierra ventas.
      </p>

      {/* Números clave */}
      {statsQuery.isError ? (
        <div className={PANEL_CARD}>
          <ErrorState onRetry={() => void statsQuery.refetch()} retrying={statsQuery.isFetching} />
        </div>
      ) : statsQuery.isLoading || !s ? (
        <div className={cn(PANEL_CARD, 'p-5')} role="status" aria-label="Cargando tus ventas">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-10 w-40" />
        </div>
      ) : (
        <div className={cn(PANEL_CARD, 'animate-rf-rise overflow-hidden')}>
          <div className="px-5 pb-4 pt-5">
            <p className="text-callout font-medium text-rf-secondary">Vendido (pagado)</p>
            <p className="mt-0.5 text-title tabular-nums">{formatMXN(s.revenue)}</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-rf-separator border-t border-rf-separator py-1.5 text-center">
            {[
              { label: 'Boletos pagados', value: s.ticketsSold },
              { label: 'Pendientes', value: s.pendingOrders, warn: s.pendingOrders > 0 },
              { label: 'Pagadas', value: s.paidOrders },
            ].map((m) => (
              <div key={m.label} className="min-w-0 px-2 py-2">
                <p className={cn('text-heading tabular-nums', m.warn ? 'text-rf-warning' : 'text-rf-label')}>
                  {m.value.toLocaleString('es-MX')}
                </p>
                <p className="mt-0.5 truncate text-caption text-rf-secondary">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link de venta */}
      {link && (
        <ListGroup
          header="Tu link de venta"
          footer="Todas las compras que se hagan desde tu link se registran como tus ventas."
        >
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-callout text-rf-secondary">{link}</p>
              {user?.sellerCode && (
                <span className="shrink-0 rounded-full bg-rf-fill-strong px-2.5 py-0.5 text-caption font-semibold tabular-nums">
                  {user.sellerCode}
                </span>
              )}
            </div>
            <Button className="mt-3 w-full" onClick={shareLink}>
              <Share2 className="h-5 w-5" /> Compartir mi link
            </Button>
          </div>
        </ListGroup>
      )}

      {/* «Ver mis ventas» siempre a la mano, aunque las métricas no carguen. */}
      <ListGroup header="Tus órdenes">
        {s && <ListRow title="Órdenes" value={s.ordersTotal.toLocaleString('es-MX')} />}
        {s && <ListRow title="Canceladas" value={s.cancelledOrders.toLocaleString('es-MX')} />}
        <ListRow icon={Receipt} title="Ver mis ventas" onClick={() => navigate('/admin/ordenes')} />
      </ListGroup>

      <ListGroup header="Ayuda">
        <ListRow icon={GraduationCap} title="Ver tutorial" subtitle="Repasa cómo vender y cobrar" onClick={startTour} />
      </ListGroup>
    </div>
  );
}

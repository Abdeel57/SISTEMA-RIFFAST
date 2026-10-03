import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService, type NotificationsSummary } from '@/services/notifications';
import { setAppBadge } from '@/lib/pwa/badge';

const ZERO: NotificationsSummary = { pendingOrders: 0, pendingProofs: 0, total: 0 };

/**
 * Resumen de avisos del rifero para los badges (tuerca + "Órdenes").
 * Sondea cada 30 s (contrato C3) y refleja el total en el icono de la app
 * (App Badging API) cuando exista. Pensado para usarse SOLO en el panel del
 * rifero — nunca en páginas públicas (el comprador no recibe avisos).
 *
 * @param enabled  desactiva el sondeo (p. ej. si no hay sesión de rifero).
 */
export function useNotificationsSummary(enabled = true): NotificationsSummary {
  const { data } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => notificationsService.summary(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 15_000,
    enabled,
    // No reventar el panel si el endpoint falla puntualmente.
    retry: 1,
  });

  const summary = data ?? ZERO;

  useEffect(() => {
    if (enabled) setAppBadge(summary.total);
  }, [enabled, summary.total]);

  return summary;
}

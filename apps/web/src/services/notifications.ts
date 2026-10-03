import { apiFetch } from '@/lib/api';

export interface NotificationsSummary {
  pendingOrders: number;
  pendingProofs: number;
  total: number;
}

export const notificationsService = {
  // Resumen de avisos del rifero (badge de la tuerca / Órdenes). Contrato C3.
  summary: () => apiFetch<NotificationsSummary>('/notifications/summary'),
};

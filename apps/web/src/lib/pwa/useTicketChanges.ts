import { useEffect, useRef } from 'react';
import type { TicketStatus } from '@bismark/shared';
import { apiFetch } from '@/lib/api';

// Forma del cambio incremental devuelto por el contrato C2.
export interface TicketChange {
  number: number;
  displayNumber: string;
  status: TicketStatus;
}

interface TicketChangesResponse {
  items: TicketChange[];
  serverTime: string;
}

const POLL_MS = 4500;

/**
 * Sondeo incremental de cambios de boletos (contrato C2). Cada ~4.5 s consulta
 * `/public/raffles/:id/ticket-changes?since=<serverTime>` y, si hay cambios,
 * invoca `onChanges` con los items fusionables por `number`.
 *
 * NO toca la cuadrícula: el consumidor decide qué hacer (p. ej. invalidar su
 * query de boletos para refrescar con datos completos). El sondeo se pausa
 * automáticamente cuando la pestaña no está visible.
 *
 * @param raffleId   rifa a observar (vacío = inactivo).
 * @param onChanges  callback con los cambios nuevos (no se llama si vienen vacíos).
 * @param enabled    permite desactivar el sondeo desde el consumidor.
 */
export function useTicketChanges(
  raffleId: string | undefined,
  onChanges: (items: TicketChange[]) => void,
  enabled = true,
): void {
  // Mantener el callback fresco sin reiniciar el intervalo en cada render.
  const cbRef = useRef(onChanges);
  cbRef.current = onChanges;

  useEffect(() => {
    if (!raffleId || !enabled) return;

    let since: string | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      // No sondear con la pestaña oculta: ahorra red/batería.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await apiFetch<TicketChangesResponse>(
          `/public/raffles/${raffleId}/ticket-changes`,
          { query: { since: since ?? undefined } },
        );
        if (stopped) return;
        if (since && res.items.length > 0) cbRef.current(res.items);
        since = res.serverTime; // primera llamada solo fija el punto de partida
      } catch {
        /* fallo puntual de red: reintentar en el siguiente ciclo */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [raffleId, enabled]);
}

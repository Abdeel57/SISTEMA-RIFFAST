import { useEffect, useState } from 'react';
import type { DigitalTicketDTO } from '@bismark/shared';
import { loadTicket, saveTicket } from './ticketStore';

interface Options {
  /** El boleto recién traído de la red (si lo hay). */
  online: DigitalTicketDTO | undefined;
  /** ¿La consulta de red falló (sin señal / error)? */
  networkFailed: boolean;
}

interface Result {
  /** Boleto a mostrar: el de red si existe, si no el guardado offline. */
  ticket: DigitalTicketDTO | undefined;
  /** Marca de tiempo (ms) en que se guardó offline, o null si nunca. */
  savedAt: number | null;
  /** Estamos mostrando la copia offline (no la de red). */
  fromCache: boolean;
  /** Todavía estamos buscando en IndexedDB la copia offline. */
  checking: boolean;
}

/**
 * Hace al boleto digital "offline-first":
 * - Con red: muestra el boleto y lo **guarda** en IndexedDB para después.
 * - Sin red: si la copia existe en IndexedDB, la **muestra** igual (con QR).
 *
 * Así el comprador (tercera edad) enseña su boleto y QR en el sorteo aunque
 * no tenga señal.
 */
export function useOfflineTicket(code: string, { online, networkFailed }: Options): Result {
  const [cached, setCached] = useState<DigitalTicketDTO | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);

  // Al montar (o cambiar de boleto): intenta leer la copia offline.
  useEffect(() => {
    let alive = true;
    setChecking(true);
    if (!code) {
      setChecking(false);
      return;
    }
    loadTicket(code).then((stored) => {
      if (!alive) return;
      if (stored) {
        setCached(stored.ticket);
        setSavedAt(stored.savedAt);
      }
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [code]);

  // Cuando llega de la red: guarda para verlo sin internet.
  useEffect(() => {
    if (!code || !online) return;
    void saveTicket(code, online).then(() => setSavedAt(Date.now()));
  }, [code, online]);

  // Mostramos la copia offline cuando no hay datos de red pero sí copia guardada.
  // `networkFailed` se usa para confirmar que es por falta de señal/error.
  const ticket = online ?? cached;
  const fromCache = !online && !!cached && networkFailed;

  return { ticket, savedAt, fromCache, checking };
}

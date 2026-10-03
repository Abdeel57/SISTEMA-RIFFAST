// Monitoreo de errores del frontend con Sentry (opcional).
// Sin VITE_SENTRY_DSN no se inicializa nada; todas las funciones son no-op.
//
// El SDK se carga por import dinámico SOLO si hay DSN, para no engordar el
// bundle inicial. Los errores que ocurran antes de que termine la carga se
// pierden (ventana de milisegundos al arranque); es un compromiso aceptable.
import type * as SentryType from '@sentry/react';
import { webEnv } from './env';

let sentry: typeof SentryType | null = null;

export async function initMonitoring(): Promise<void> {
  if (!webEnv.sentryDsn) return;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn: webEnv.sentryDsn,
    environment: webEnv.prod ? 'production' : 'development',
    tracesSampleRate: 0, // sin tracing de performance por ahora (ruido/costo)
    // Captura solo errores no controlados; sin session replay (privacidad/peso).
  });
  sentry = Sentry;
}

export function captureError(error: unknown): void {
  sentry?.captureException(error);
}

// Monitoreo de errores con Sentry (opcional). Sin SENTRY_DSN no se inicializa
// nada y todas las funciones son no-op: el código las puede llamar sin guardas.
import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

let enabled = false;

export function initSentry(): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.sentryTracesSampleRate,
  });
  enabled = true;
}

export function captureError(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}

export const sentryEnabled = (): boolean => enabled;

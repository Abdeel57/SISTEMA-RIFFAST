// Analítica de producto con PostHog (opcional). Sin VITE_POSTHOG_KEY no se
// inicializa nada y track()/identify() son no-op: se pueden llamar sin guardas.
//
// El SDK se carga por import dinámico SOLO si hay key, para no engordar el
// bundle inicial (clave en una PWA mobile-first). Configurado sin cookies
// (persistence: localStorage) y sin session replay → sin banner de consentimiento.
// Mide el embudo: registro → rifa publicada → orden apartada → compra de plan.
import type { PostHog } from 'posthog-js';
import { webEnv } from './env';

// Eventos clave del embudo. Usar nombres estables (no traducir luego).
export type AnalyticsEvent =
  | 'signup_completed'
  | 'login_completed'
  | 'raffle_published'
  | 'order_reserved'
  | 'plan_checkout_started'
  | 'plan_purchased';

let ph: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
  if (!webEnv.posthogKey) return;
  const { default: posthog } = await import('posthog-js');
  posthog.init(webEnv.posthogKey, {
    api_host: webEnv.posthogHost,
    persistence: 'localStorage', // sin cookies → sin banner de consentimiento
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    autocapture: false, // sólo eventos explícitos: menos ruido
  });
  ph = posthog;
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  ph?.capture(event, props);
}

export function identify(userId: string, props?: Record<string, unknown>): void {
  ph?.identify(userId, props);
}

export function resetAnalytics(): void {
  ph?.reset();
}

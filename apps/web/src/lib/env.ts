export const webEnv = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api',
  brandName: (import.meta.env.VITE_BRAND_NAME as string | undefined) || 'Riffast',
  // WhatsApp de Riffast (el desarrollador del sitio). Lo enlaza el pie de
  // página "Desarrollado por Riffast". Número con código de país, sin "+".
  riffastWhatsapp: (import.meta.env.VITE_RIFFAST_WHATSAPP as string | undefined) || '',
  // Monitoreo de errores (Sentry) y analítica (PostHog). Vacío = desactivado.
  sentryDsn: (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '',
  posthogKey: (import.meta.env.VITE_POSTHOG_KEY as string | undefined) || '',
  posthogHost: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com',
  prod: import.meta.env.PROD,
};

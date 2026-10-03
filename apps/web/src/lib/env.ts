export const webEnv = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api',
  brandName: (import.meta.env.VITE_BRAND_NAME as string | undefined) || 'Riffast',
  // WhatsApp de Riffast (el desarrollador del sitio). Lo enlaza el pie de
  // página "Desarrollado por Riffast". Número con código de país, sin "+".
  riffastWhatsapp: (import.meta.env.VITE_RIFFAST_WHATSAPP as string | undefined) || '',
  // Chat de atención 24 h del administrador (burbuja «Asistencia»). URL de la
  // ventana de chat que se abre dentro del panel. Vacío = se ofrece WhatsApp.
  supportChatUrl: (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim() || '',
  // Monitoreo de errores (Sentry) y analítica (PostHog). Vacío = desactivado.
  sentryDsn: (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '',
  posthogKey: (import.meta.env.VITE_POSTHOG_KEY as string | undefined) || '',
  posthogHost: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com',
  prod: import.meta.env.PROD,
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initMonitoring } from '@/lib/monitoring';
import { initAnalytics } from '@/lib/analytics';
import { initServiceWorker } from '@/lib/pwa/swUpdate';
// Captura temprana de `beforeinstallprompt` (invitación a instalar del admin).
import '@/lib/pwa/installState';
import './index.css';

// Monitoreo (Sentry) y analítica (PostHog). Cargan su SDK por import dinámico
// solo si hay env configurada; si no, son no-op. Fire-and-forget.
void initMonitoring();
void initAnalytics();

// Service Worker (PWA). La versión nueva espera a «Actualizar» en el admin.
initServiceWorker();

// Red de seguridad tras un despliegue: si una pestaña vieja pide un archivo de
// la versión anterior que ya no existe, recargar una vez para tomar la nueva.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('riffast:chunk-reload') === '1') return;
    sessionStorage.setItem('riffast:chunk-reload', '1');
  } catch {
    /* sin almacenamiento: recargar igual */
  }
  event.preventDefault();
  window.location.reload();
});
// Si la app arrancó bien, se permite otra recarga de rescate en un despliegue
// posterior (la marca solo evita ciclos de recarga inmediatos).
setTimeout(() => {
  try {
    sessionStorage.removeItem('riffast:chunk-reload');
  } catch {
    /* noop */
  }
}, 10_000);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

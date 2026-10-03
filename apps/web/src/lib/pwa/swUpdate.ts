import { create } from 'zustand';

// Registro del Service Worker y aviso de versión nueva.
//
// Cuándo entra una versión nueva lo decide el propio SW (ver sw.ts): si en el
// dispositivo no hay un administrador abierto, se activa sola, como siempre (el
// comprador recibe lo último sin avisos). Si el rifero tiene el administrador
// abierto, la versión espera y aquí se muestra «Actualizar» (UpdatePrompt):
// nunca se le recarga la pantalla a media tarea.

interface SwUpdateState {
  /** Hay una versión nueva lista para usarse. */
  needRefresh: boolean;
  /** Activa la versión nueva y recarga la página. */
  update: () => void;
  /** Oculta el aviso hasta la próxima carga. */
  dismiss: () => void;
}

const HOUR = 60 * 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;
let sawUpdate = false;
let reloading = false;

function isAdminRoute(): boolean {
  const p = window.location.pathname;
  return p === '/login' || p === '/admin' || p.startsWith('/admin/');
}

function reloadOnce(): void {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

export const useSwUpdate = create<SwUpdateState>((set) => ({
  needRefresh: false,
  update: () => {
    set({ needRefresh: false });
    const waiting = registration?.waiting;
    // Otra pestaña ya la activó: basta con recargar.
    if (!waiting) {
      reloadOnce();
      return;
    }
    // Recargar en cuanto la versión nueva tome el control, o en cuanto se active
    // si esta pestaña no tenía SW (se abrió con recarga forzada).
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
    waiting.addEventListener('statechange', () => {
      if (waiting.state === 'activated') reloadOnce();
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  },
  dismiss: () => set({ needRefresh: false }),
}));

function updateReady(): void {
  sawUpdate = true;
  if (isAdminRoute()) useSwUpdate.setState({ needRefresh: true });
}

function watch(reg: ServiceWorkerRegistration): void {
  registration = reg;
  if (reg.waiting && reg.active) updateReady();
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    next?.addEventListener('statechange', () => {
      // Instalada con otra versión activa = actualización. (En la primera
      // instalación no hay versión activa y no hay nada que avisar.)
      if (next.state === 'installed' && reg.active) updateReady();
    });
  });
  // La versión nueva entró desde otra pestaña: en el administrador no se recarga
  // de sorpresa; queda el aviso para que el rifero recargue cuando quiera.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sawUpdate && !reloading && isAdminRoute()) useSwUpdate.setState({ needRefresh: true });
  });

  // La app instalada puede quedar abierta días: buscar versión nueva cada hora y
  // al volver a la app (como mucho cada media hora).
  let lastCheck = Date.now();
  const check = () => {
    if (!isAdminRoute() || !navigator.onLine || Date.now() - lastCheck < HOUR / 2) return;
    lastCheck = Date.now();
    reg.update().catch(() => {
      /* sin red o servidor caído: se reintenta en la siguiente vuelta */
    });
  };
  setInterval(check, HOUR);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

export function initServiceWorker(): void {
  // En desarrollo no hay SW (devOptions desactivado), igual que antes.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(watch)
      .catch(() => {
        /* sin SW la app funciona igual (solo sin modo app ni avisos) */
      });
  };
  // Después de la carga, como antes: en la primera visita el SW descarga todo el
  // esqueleto y no debe competir con la portada, las fotos y la API.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

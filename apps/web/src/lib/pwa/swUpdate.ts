import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

// Registro del Service Worker y aviso de versión nueva.
//
// El SW nuevo NO se activa solo: espera a que el rifero toque «Actualizar» en
// el administrador (UpdatePrompt). En las páginas públicas no se interrumpe al
// comprador: la versión nueva entra cuando cierra la pestaña.

interface SwUpdateState {
  /** Hay una versión nueva instalada esperando. */
  needRefresh: boolean;
  /** Activa la versión nueva y recarga la página. */
  update: () => void;
  /** Oculta el aviso hasta la próxima carga. */
  dismiss: () => void;
}

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

export const useSwUpdate = create<SwUpdateState>((set) => ({
  needRefresh: false,
  update: () => {
    void applyUpdate?.(true);
  },
  dismiss: () => set({ needRefresh: false }),
}));

const HOUR = 60 * 60 * 1000;

export function initServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      useSwUpdate.setState({ needRefresh: true });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // La app instalada puede quedar abierta días: buscar versión nueva cada hora.
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, HOUR);
    },
  });
}

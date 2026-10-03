import { useEffect, useReducer } from 'react';

// Estado de instalación de la PWA para el ADMINISTRADOR.
//
// `beforeinstallprompt` se dispara una sola vez, muy temprano. Este módulo se
// importa al arrancar la app (main.tsx) para no perderlo aunque el rifero entre
// directo a otra sección; las pantallas lo leen después con useAdminInstall().

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // el aviso lo mostramos nosotros (con el botón «Instalar»)
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac: se distingue por la pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * - `installed`: ya se abre como app (no se invita).
 * - `ios`: iPhone/iPad en el navegador → se explican los pasos (Compartir → Agregar a inicio).
 * - `prompt`: Android/Chrome ofrece instalar → aviso nativo del navegador.
 * - `none`: el navegador no permite instalar ahora (no se muestra nada).
 */
export type InstallPlatform = 'installed' | 'ios' | 'prompt' | 'none';

export function useAdminInstall(): { platform: InstallPlatform; promptInstall: () => Promise<boolean> } {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const platform: InstallPlatform =
    installedNow || isStandalone() ? 'installed' : isIOS() ? 'ios' : deferred ? 'prompt' : 'none';

  const promptInstall = async (): Promise<boolean> => {
    if (!deferred) return false;
    const ev = deferred;
    await ev.prompt();
    const choice = await ev.userChoice;
    deferred = null; // cada evento sirve una sola vez
    notify();
    return choice.outcome === 'accepted';
  };

  return { platform, promptInstall };
}

// Recordar «Ahora no» por un tiempo (no molestar en cada visita).
const HIDE_KEY = 'riffast:admin-install-hide-until';
const HIDE_DAYS = 14;

export function installInviteHidden(): boolean {
  try {
    return Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function hideInstallInvite(): void {
  try {
    localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    /* almacenamiento no disponible */
  }
}

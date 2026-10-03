import { useEffect } from 'react';

// Puente entre la intro de Riffast (public/riffast-intro.js) y la app.
//
// index.html monta la intro ANTES que React —para tapar la página desde el
// primer pintado— con autoReady:false: no sale sola, espera a que la app llame
// ready(). La app la suelta cuando ya no queda ninguna pantalla de carga que la
// "sostenga" (BrandLoader a pantalla completa, guardas de sesión, arranque del
// panel). Si algo falla, la intro sale igual por su maxWait.

interface IntroInstance {
  ready(): unknown;
  state?: string;
}
interface IntroApi {
  mount(options?: Record<string, unknown>): IntroInstance;
}
declare global {
  interface Window {
    RiffastIntro?: IntroApi;
    __riffastIntro?: IntroInstance;
    /** Opciones de la intro, definidas una sola vez en index.html. */
    __riffastIntroOptions?: Record<string, unknown>;
  }
}

// Margen antes de soltar: entre dos cargas encadenadas (fallback de Suspense →
// pantalla de carga de la página) el contador puede pasar un instante por cero.
const SETTLE_MS = 50;

// Tope de espera por las tipografías: con conexión lenta no vale la pena tapar
// más la página por evitar el cambio de fuente.
const FONTS_MAX_MS = 1000;

let holds = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRelease(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (holds === 0) window.__riffastIntro?.ready();
  }, SETTLE_MS);
}

/** Pide que la intro siga en pantalla; devuelve la función que la libera. */
export function holdIntro(): () => void {
  holds += 1;
  clearTimeout(timer);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0) scheduleRelease();
  };
}

/** Sostiene la intro mientras el componente esté montado (y `active`). */
export function useIntroHold(active = true): void {
  useEffect(() => (active ? holdIntro() : undefined), [active]);
}

/** useIntroHold en forma de componente, para ponerlo junto a un fallback. */
export function IntroHold(): null {
  useIntroHold();
  return null;
}

// Las tipografías de Google Fonts cargan sin bloquear el primer pintado
// (index.html, <link id="app-fonts" media="print">). Resuelve cuando su hoja ya
// cargó y las caras que se ven primero están listas.
function fontsReady(): Promise<void> {
  const link = document.getElementById('app-fonts') as HTMLLinkElement | null;
  const sheet = new Promise<void>((resolve) => {
    if (!link || link.media === 'all') return resolve();
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
  return sheet.then(() => {
    const fonts = document.fonts;
    if (!fonts?.load) return;
    // Se piden de forma explícita: el navegador solo descarga las que usa el
    // texto ya pintado, y bajo la intro todavía no hay texto.
    return Promise.all([
      fonts.load('400 16px Inter'),
      fonts.load('700 16px Inter'),
      fonts.load('800 24px "Bricolage Grotesque"'),
    ]).then(() => undefined);
  });
}

/** Arranque de la app: la intro sale en cuanto ninguna pantalla la sostenga. */
export function useIntroBoot(): void {
  useEffect(() => {
    if (isIntroPlaying()) {
      const release = holdIntro();
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONTS_MAX_MS));
      Promise.race([fontsReady(), timeout]).then(release, release);
    }
    scheduleRelease();
  }, []);
}

/** ¿Hay una intro en pantalla (aún sin terminar)? */
export function isIntroPlaying(): boolean {
  const current = window.__riffastIntro;
  return !!current && current.state !== 'done';
}

/** Ejecuta `fn` al terminar la intro (o de inmediato si no hay ninguna). */
export function afterIntro(fn: () => void): void {
  if (!isIntroPlaying()) {
    fn();
    return;
  }
  document.addEventListener('riffast-intro:done', () => fn(), { once: true });
}

/** Vuelve a reproducir la intro (al entrar al panel tras iniciar sesión). */
export function playIntro(): void {
  if (!window.RiffastIntro || isIntroPlaying()) return;
  try {
    window.__riffastIntro = window.RiffastIntro.mount({ ...window.__riffastIntroOptions, autoReady: false });
  } catch {
    return;
  }
  // Si nadie la sostiene (datos ya en caché), sale apenas se forme el trébol.
  if (holds === 0) scheduleRelease();
}

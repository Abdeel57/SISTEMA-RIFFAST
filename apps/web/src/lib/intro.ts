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
  }
}

// Mismas opciones que index.html (y que la landing): sale en cuanto se forma el
// trébol si la app ya está lista, y nunca tapa más de 6 s.
const OPTIONS = { ink: '#FFFFFF', autoReady: false, minTime: 1.5, maxWait: 6 };

// Margen antes de soltar: entre dos cargas encadenadas (fallback de Suspense →
// pantalla de carga de la página) el contador pasa un instante por cero.
const SETTLE_MS = 150;

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

/** Arranque de la app: si ninguna pantalla pidió sostener la intro, que salga. */
export function useIntroBoot(): void {
  useEffect(() => {
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
    window.__riffastIntro = window.RiffastIntro.mount(OPTIONS);
  } catch {
    return;
  }
  // Si nadie la sostiene (datos ya en caché), sale apenas se forme el trébol.
  if (holds === 0) scheduleRelease();
}

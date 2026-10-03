import { useEffect, useRef, useState } from 'react';

// Revela un elemento cuando entra en el viewport (para animaciones al hacer scroll).
// La animación es mejora progresiva: si no hay IntersectionObserver, el contenido
// nace visible; y un temporizador de seguridad revela todo aunque no haya scroll
// (crawlers, capturas de página completa, errores del observer) para que la página
// nunca quede con secciones invisibles.
export function useInView<T extends HTMLElement = HTMLDivElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options },
    );
    obs.observe(el);
    const failsafe = setTimeout(() => setInView(true), 2500);
    return () => {
      obs.disconnect();
      clearTimeout(failsafe);
    };
  }, [inView, options]);

  return { ref, inView };
}

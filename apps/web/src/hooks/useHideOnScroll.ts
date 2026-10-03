import { useEffect, useState } from 'react';

// Oculta elementos flotantes (tuerca, sello) mientras el usuario se desplaza
// hacia abajo y los vuelve a mostrar al subir o al detenerse. Doble beneficio
// en móvil: el contenido queda despejado durante la lectura, y el salto que
// dan los elementos `fixed` cuando el navegador colapsa la barra de URL ocurre
// mientras están ocultos (adiós al "se deslizan" feo).
export function useHideOnScroll(threshold = 120): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let idleTimer: number | undefined;

    const onScroll = () => {
      const y = window.scrollY;
      if (y < threshold) {
        setHidden(false);
      } else if (y > lastY + 4) {
        setHidden(true); // bajando
      } else if (y < lastY - 4) {
        setHidden(false); // subiendo
      }
      lastY = y;
      // Reaparecer al soltar el dedo / detener el scroll.
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setHidden(false), 500);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idleTimer);
    };
  }, [threshold]);

  return hidden;
}

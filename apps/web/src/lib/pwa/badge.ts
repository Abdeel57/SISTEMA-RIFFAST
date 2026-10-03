// App Badging API (icono de la app instalada). Soportada en Chrome/Edge de
// escritorio y algunas PWAs instaladas; en el resto las llamadas son no-op.
//
// Los tipos no están en lib.dom estándar, así que los declaramos aquí de forma
// laxa para no romper el typecheck en navegadores sin la API.
interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/**
 * Refleja `total` en el badge del icono de la app instalada.
 * `0` o negativo limpia el badge. Silencioso si la API no existe o falla.
 */
export function setAppBadge(total: number): void {
  const nav = navigator as Navigator & BadgeNavigator;
  try {
    if (total > 0) {
      void nav.setAppBadge?.(total);
    } else {
      void nav.clearAppBadge?.();
    }
  } catch {
    /* API no disponible: ignorar */
  }
}

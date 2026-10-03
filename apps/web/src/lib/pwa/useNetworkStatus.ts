import { useEffect, useState } from 'react';

/**
 * Estado de conexión del navegador (online/offline).
 *
 * Escucha los eventos `online`/`offline` de `window`. `navigator.onLine` es
 * conservador (true salvo que el SO confirme que no hay red), pero es suficiente
 * para mostrar/ocultar un banner global de "Sin conexión".
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Sincroniza por si cambió entre el render inicial y el mount.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

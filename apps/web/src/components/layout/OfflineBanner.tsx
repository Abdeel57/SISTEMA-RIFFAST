import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/lib/pwa/useNetworkStatus';

/**
 * Banner global "Sin conexión". Se monta una sola vez (en App) y aparece fijo
 * arriba cuando el navegador pierde la red. No bloquea la interacción: solo
 * informa. Respeta el notch superior con `safe-top`.
 */
export function OfflineBanner() {
  const online = useNetworkStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-md safe-top"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Sin conexión. Algunas funciones no estarán disponibles.
    </div>
  );
}

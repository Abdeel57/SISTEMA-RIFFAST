import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

// Cuenta regresiva EN VIVO del apartado en el recibo. Mientras corre, muestra el
// tiempo restante; al vencer, avisa que los boletos se liberaron (antes el aviso
// simplemente desaparecía sin explicación).
const pad = (n: number) => String(n).padStart(2, '0');

export function ReserveTimer({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;

  if (ms <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Tu apartado venció y los boletos se liberaron. Si siguen disponibles, vuelve a apartarlos.</span>
      </div>
    );
  }

  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const txt = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        Tienes <strong className="tabular-nums">{txt}</strong> para pagar antes de que se liberen tus boletos.
      </span>
    </div>
  );
}

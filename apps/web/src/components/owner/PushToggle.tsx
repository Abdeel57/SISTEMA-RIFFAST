import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  disablePush,
  enablePush,
  getPushState,
  isPushSupported,
  type PushState,
} from '@/lib/pwa/push';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

/**
 * Toggle "Activar avisos" para el RIFERO. Suscribe/desuscribe el navegador a
 * Web Push (contrato C1). El backend avisa al rifero de nuevas órdenes y
 * comprobantes. ❌ Nunca se monta en páginas públicas; el comprador no recibe push.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPushState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isPushSupported() || state === 'unsupported') {
    return null; // navegador sin soporte (p. ej. iOS no instalado): no mostrar
  }

  const subscribed = state === 'subscribed';
  const denied = state === 'denied';

  const onToggle = async (next: boolean) => {
    setBusy(true);
    try {
      const result = next ? await enablePush() : await disablePush();
      setState(result);
      if (next) {
        if (result === 'subscribed') toast.success('Avisos activados');
        else if (result === 'denied')
          toast.error('Permiso bloqueado. Actívalo en los ajustes del navegador.');
      } else {
        toast.success('Avisos desactivados');
      }
    } catch {
      toast.error('No se pudieron actualizar los avisos');
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Avisos en este dispositivo</p>
          <p className="text-sm text-muted-foreground">
            Recibe una notificación cuando alguien aparte boletos o suba un comprobante.
          </p>
          {denied && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              Los avisos están bloqueados en tu navegador. Habilítalos en los permisos del sitio.
            </p>
          )}
        </div>
        <Switch
          checked={subscribed}
          disabled={busy || denied || state === null}
          onCheckedChange={(v) => void onToggle(v)}
          aria-label="Activar avisos"
        />
      </CardContent>
    </Card>
  );
}

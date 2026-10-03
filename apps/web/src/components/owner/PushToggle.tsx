import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import {
  disablePush,
  enablePush,
  getPushState,
  isPushSupported,
  type PushState,
} from '@/lib/pwa/push';
import { ListGroup, ListRow, ToggleRow } from '@/components/owner/List';
import { IosInstallSheet } from '@/components/owner/InstallApp';
import { isIOS, isStandalone } from '@/lib/pwa/installState';
import { Button } from '@/components/ui/button';

/**
 * Toggle "Activar avisos" para el RIFERO. Suscribe/desuscribe el navegador a
 * Web Push (contrato C1). El backend avisa al rifero de nuevas órdenes y
 * comprobantes. ❌ Nunca se monta en páginas públicas; el comprador no recibe push.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

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
    // iPhone/iPad en el navegador: los avisos solo llegan con la app instalada
    // (iOS 16.4+). En lugar de ocultar la opción, explicar cómo activarla.
    if (isIOS() && !isStandalone()) {
      return (
        <ListGroup header="Avisos">
          <ListRow
            icon={Bell}
            iconTone="neutral"
            title="Avisos en este dispositivo"
            subtitle="En iPhone, los avisos de cada apartado llegan con la app instalada en tu pantalla de inicio (iOS 16.4 o posterior)."
            trailing={
              <Button size="sm" variant="ghost" className="px-2" onClick={() => setIosOpen(true)}>
                Ver cómo
              </Button>
            }
          />
          <IosInstallSheet open={iosOpen} onOpenChange={setIosOpen} />
        </ListGroup>
      );
    }
    return null; // navegador sin soporte: no mostrar
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
    <ListGroup header="Avisos">
      <ToggleRow
        id="push-toggle"
        icon={Bell}
        title="Avisos en este dispositivo"
        description="Recibe una notificación cuando alguien aparte boletos o suba un comprobante."
        note={denied ? 'Los avisos están bloqueados en tu navegador. Habilítalos en los permisos del sitio.' : undefined}
        checked={subscribed}
        disabled={busy || denied || state === null}
        onCheckedChange={(v) => void onToggle(v)}
        switchLabel="Activar avisos"
      />
    </ListGroup>
  );
}

import { useState } from 'react';
import { Share, SquarePlus, Smartphone, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminInstall,
  installInviteHidden,
  hideInstallInvite,
} from '@/lib/pwa/installState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PANEL_CARD } from '@/components/owner/PanelKit';
import { ListRow } from '@/components/owner/List';
import { cn } from '@/lib/cn';

// Hoja con los pasos para instalar en iPhone/iPad (Safari no tiene botón
// «Instalar»: se agrega desde Compartir → Agregar a inicio).
export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = [
    {
      icon: Share,
      text: (
        <>
          Toca <strong className="font-semibold text-rf-label">Compartir</strong> en la barra de Safari.
        </>
      ),
    },
    {
      icon: SquarePlus,
      text: (
        <>
          Elige <strong className="font-semibold text-rf-label">«Agregar a inicio»</strong>.
        </>
      ),
    },
    {
      icon: Check,
      text: (
        <>
          Toca <strong className="font-semibold text-rf-label">«Agregar»</strong>. Listo: abre Riffast desde tu pantalla
          de inicio.
        </>
      ),
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instala Riffast en tu iPhone</DialogTitle>
          <DialogDescription>
            Se abre a pantalla completa, como una app, y recibe un aviso con cada apartado.
          </DialogDescription>
        </DialogHeader>
        <ol className="overflow-hidden rounded-control ring-1 ring-inset ring-rf-separator [&>*+*]:border-t [&>*+*]:border-rf-separator">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i} className="flex items-center gap-3.5 px-4 py-3">
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-rf-fill-strong text-rf-info">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </span>
                <span className="text-callout text-rf-secondary">
                  <span className="mr-1 font-semibold tabular-nums text-rf-label">{i + 1}.</span>
                  {s.text}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-rf-secondary">
          Los avisos de apartados en iPhone funcionan con la app instalada y iOS 16.4 o posterior. Después actívalos en
          Más → Ajustes → Avisos.
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lógica compartida: en Android abre el aviso nativo del navegador; en iPhone,
// la hoja con los pasos.
function useInstallAction() {
  const { platform, promptInstall } = useAdminInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const run = async () => {
    if (platform === 'ios') {
      setIosOpen(true);
      return;
    }
    const accepted = await promptInstall();
    if (accepted) toast.success('¡Listo! Abre Riffast desde tu pantalla de inicio.');
  };
  const sheet = <IosInstallSheet open={iosOpen} onOpenChange={setIosOpen} />;
  return { platform, run, sheet };
}

// Tarjeta de invitación en Inicio. No aparece si ya está instalada, si el
// navegador no permite instalar o si el rifero tocó «Ahora no» hace poco.
export function InstallCard({ className }: { className?: string }) {
  const { platform, run, sheet } = useInstallAction();
  const [hidden, setHidden] = useState(installInviteHidden);
  if (platform === 'installed' || platform === 'none' || hidden) return sheet;

  return (
    <>
      <div className={cn(PANEL_CARD, 'flex gap-3.5 p-4 animate-rf-rise', className)}>
        <img
          src="/apple-touch-icon.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-[11px] shadow-card"
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-rf-label">Instala la app en tu teléfono</p>
          <p className="mt-0.5 text-callout text-rf-secondary">
            Ábrela desde tu pantalla de inicio y recibe un aviso con cada apartado.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void run()}>
              {platform === 'ios' ? (
                <>
                  <Smartphone className="h-[18px] w-[18px]" /> Ver cómo
                </>
              ) : (
                <>
                  <Download className="h-[18px] w-[18px]" /> Instalar
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hideInstallInvite();
                setHidden(true);
              }}
            >
              Ahora no
            </Button>
          </div>
        </div>
      </div>
      {sheet}
    </>
  );
}

// Fila «Instalar la app» para la pestaña Más (siempre disponible mientras se pueda).
export function InstallRow() {
  const { platform, run, sheet } = useInstallAction();
  if (platform === 'installed' || platform === 'none') return sheet;
  return (
    <>
      <ListRow
        icon={Download}
        title="Instalar la app"
        subtitle={platform === 'ios' ? 'Agrégala a tu pantalla de inicio' : 'Ábrela como app y recibe avisos'}
        onClick={() => void run()}
      />
      {sheet}
    </>
  );
}

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageCircle, Send, Store } from 'lucide-react';
import { ORDER_PAYMENT_METHODS, formatTicketNumber, type OrderPaymentMethod, type RaffleDTO } from '@riffast/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PANEL_CARD } from '@/components/owner/PanelKit';
import { useMoney } from '@/store/site';
import { cn } from '@/lib/cn';

// Orden de PRÁCTICA del tutorial: se ve y se usa igual que una tarjeta de
// Órdenes (Marcar pagado → ¿Cómo pagó? → Sí, confirmar pago), pero vive solo en
// pantalla: no se guarda nada ni se avisa a nadie.

export type PracticePhase = 'apartada' | 'confirmar' | 'pagada';

const METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

interface DemoRaffle {
  title: string;
  eventLabel: string;
  price: number;
  tickets: string[];
}

// Toma la rifa más reciente del rifero (publicada de preferencia) para que la
// práctica se sienta suya; si no hay, una rifa de ejemplo.
function useDemoRaffle(): DemoRaffle {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const items = queryClient.getQueryData<{ items: RaffleDTO[] }>(['raffles'])?.items ?? [];
    const r = items.find((x) => x.status === 'PUBLISHED') ?? items[0];
    if (!r) return { title: 'Rifa de ejemplo', eventLabel: 'E1', price: 50, tickets: ['007', '021'] };
    const pick = (offset: number) => Math.min(r.ticketStart + offset, r.ticketEnd);
    const nums = Array.from(new Set([pick(6), pick(20)]));
    return {
      title: r.title,
      eventLabel: r.eventLabel,
      price: r.ticketPrice,
      tickets: nums.map((n) => formatTicketNumber(n, r.ticketFormat)),
    };
  }, [queryClient]);
}

export function PracticeOrder({ phase, onPhase }: { phase: PracticePhase; onPhase: (p: PracticePhase) => void }) {
  const money = useMoney();
  const demo = useDemoRaffle();
  const [method, setMethod] = useState<OrderPaymentMethod>('transferencia');
  const [saving, setSaving] = useState(false);
  const total = demo.price * demo.tickets.length;
  const paid = phase === 'pagada';

  const confirm = () => {
    setSaving(true);
    // Pausa breve para que se sienta como el botón real («Confirmando…»).
    window.setTimeout(() => {
      setSaving(false);
      onPhase('pagada');
    }, 650);
  };

  return (
    <article className={cn(PANEL_CARD, 'relative overflow-hidden p-4 text-left ring-1 ring-rf-separator')} aria-label="Orden de práctica">
      <span className="absolute right-0 top-0 rounded-bl-[10px] bg-rf-info/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-rf-info">
        Práctica
      </span>

      <div className="flex items-start justify-between gap-3 pr-16">
        <div className="min-w-0">
          <h3 className="truncate text-body font-semibold text-rf-label">María López</h3>
          <p className="text-callout tabular-nums text-rf-secondary">+52 662 000 0000</p>
        </div>
      </div>
      <div className="mt-2">
        <Badge variant={paid ? 'success' : 'warning'}>{paid ? 'Pagada' : 'Apartada'}</Badge>
      </div>

      <div className="mt-2 space-y-1 text-caption text-rf-secondary">
        <p className="truncate">
          <span className="font-semibold tabular-nums text-rf-label">BSK-DEMO01</span> · {demo.title} · {demo.eventLabel}
        </p>
        <p className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 shrink-0" /> Venta directa
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {demo.tickets.map((n) => (
          <span key={n} className="rounded-[8px] bg-rf-fill px-2 py-1 text-callout font-semibold tabular-nums text-rf-label">
            {n}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-rf-separator pt-3">
        <p className="text-heading tabular-nums text-rf-label">{money(total)}</p>
        {!paid && (
          <span className="shrink-0 rounded-full bg-rf-warning/[0.12] px-2.5 py-1 text-caption font-semibold text-rf-warning">
            Vence en 1 h 59 min
          </span>
        )}
      </div>

      {paid && (
        <p className="mt-2 text-caption text-rf-secondary">
          Pagado en <span className="font-semibold text-rf-label">{METHOD_LABEL[method]}</span>
        </p>
      )}

      {/* Acciones, igual que en Órdenes */}
      {phase === 'apartada' && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-rf-accent/60 motion-safe:animate-pulse" />
            <Button variant="secondary" size="sm" className="w-full" onClick={() => onPhase('confirmar')}>
              Marcar pagado
            </Button>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rf-fill text-rf-label" aria-hidden>
            <MessageCircle className="h-[22px] w-[22px]" />
          </span>
        </div>
      )}

      {phase === 'confirmar' && (
        <div className="mt-3 animate-rf-rise space-y-3 rounded-control bg-rf-fill/70 p-3">
          <p className="text-callout text-rf-label">
            ¿Confirmas que <span className="font-semibold">María López</span> ya pagó{' '}
            <span className="font-semibold">{money(total)}</span>?
          </p>
          <div>
            <Label htmlFor="tour-pay-method">¿Cómo pagó?</Label>
            <Select id="tour-pay-method" value={method} onChange={(e) => setMethod(e.target.value as OrderPaymentMethod)}>
              {ORDER_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => onPhase('apartada')} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-[2]" loading={saving} loadingText="Confirmando…" onClick={confirm}>
              Sí, confirmar pago
            </Button>
          </div>
        </div>
      )}

      {paid && (
        <div className="mt-3 animate-rf-rise space-y-3">
          <p className="flex items-start gap-2 rounded-control bg-rf-accent/[0.08] px-3 py-2.5 text-callout text-rf-label">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rf-accent" />
            <span>
              ¡Pago confirmado! En una orden real se abre WhatsApp con su <span className="font-semibold">boleto digital</span>{' '}
              listo para enviárselo.
            </span>
          </p>
          <Button variant="secondary" size="sm" className="w-full" disabled>
            <Send className="h-[18px] w-[18px]" /> Enviar boleto
          </Button>
        </div>
      )}
    </article>
  );
}

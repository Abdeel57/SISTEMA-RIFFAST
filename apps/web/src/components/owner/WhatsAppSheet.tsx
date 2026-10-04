import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Clock, CreditCard, MessageCircle, Unlock, type LucideIcon } from 'lucide-react';
import { dialCodeForCountry, formatPhoneIntl, timeRemaining, type OrderDTO, type PaymentMethodDTO } from '@riffast/shared';
import { usePortalContainer } from '@/components/ui/surface';
import { IconTile } from '@/components/owner/List';
import { riferoService } from '@/services/riferos';
import { raffleService } from '@/services/raffles';
import { publicService } from '@/services/publicSite';
import { buildSellerRaffleUrl, buildRaffleUrl } from '@/lib/site';
import { useAuthStore } from '@/store/auth';
import { useMoney } from '@/store/site';
import {
  WA_TEMPLATES,
  firstName,
  longDrawDate,
  paymentBlocks,
  waLink,
  type WaTemplateContext,
  type WaTemplateId,
} from '@/lib/whatsappTemplates';
// Hoja «WhatsApp» de una orden: mensajes listos para enviar al comprador.
// Cada opción abre wa.me con el texto y cierra la hoja. El enlace se recalcula
// DENTRO del toque (sin esperas) para que iOS no lo bloquee en la PWA instalada
// y para que el tiempo restante sea el del momento.

const ICONS: Record<WaTemplateId, LucideIcon> = {
  conversacion: MessageCircle,
  recordatorio: Clock,
  datos_pago: CreditCard,
  confirmacion: BadgeCheck,
  fecha_sorteo: CalendarDays,
  liberados: Unlock,
};

type Kind = 'apartada' | 'pagada' | 'liberada' | 'otra';

function kindOf(status: OrderDTO['status']): Kind {
  if (status === 'RESERVED' || status === 'PENDING') return 'apartada';
  if (status === 'PAID') return 'pagada';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'liberada';
  return 'otra'; // rechazada: solo «Ver conversación»
}

const eventNumberOf = (label: string) => Number(label.replace(/\D/g, '')) || 0;

// Datos de la cuenta que necesitan las plantillas, de la BD de cada cliente:
// métodos de pago (los mismos que ve el comprador al apartar) y fecha del
// sorteo. El administrador ya los tiene en caché (perfil y rifas); el vendedor
// no puede leerlos, así que usa la vista pública de la rifa.
function useOrderWaData(order: OrderDTO, enabled: boolean) {
  const isSeller = useAuthStore((s) => s.user?.role === 'SELLER');
  const eventNumber = eventNumberOf(order.eventLabel);
  const profileQ = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
    enabled: enabled && !isSeller,
    staleTime: 60_000,
  });
  const rafflesQ = useQuery({
    queryKey: ['raffles'],
    queryFn: () => raffleService.list(),
    enabled: enabled && !isSeller,
    staleTime: 60_000,
  });
  const publicQ = useQuery({
    queryKey: ['public-raffle-wa', eventNumber],
    queryFn: () => publicService.raffleByEvent('_', eventNumber),
    enabled: enabled && isSeller && eventNumber > 0,
    staleTime: 60_000,
    retry: false,
  });

  if (isSeller) {
    const raffle = publicQ.data?.raffle;
    return {
      loading: publicQ.isLoading,
      methods: (raffle?.paymentProfile.methods ?? []) as PaymentMethodDTO[],
      drawDate: raffle?.drawDate ?? null,
    };
  }
  const raffle = rafflesQ.data?.items.find((r) => r.id === order.raffleId);
  return {
    loading: profileQ.isLoading || rafflesQ.isLoading,
    methods: profileQ.data?.profile.paymentMethods ?? [],
    drawDate: raffle?.drawDate ?? null,
  };
}

interface Option {
  id: WaTemplateId;
  title: string;
  preview: string;
  href: () => string;
}

export function WhatsAppSheet({
  order,
  open,
  onOpenChange,
}: {
  order: OrderDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const container = usePortalContainer();
  const money = useMoney();
  const sellerCode = useAuthStore((s) => (s.user?.role === 'SELLER' ? s.user.sellerCode : null));
  const { loading, methods, drawDate } = useOrderWaData(order, open);

  const phone = order.buyer.whatsapp || order.buyer.phone;
  const dial = dialCodeForCountry(order.buyer.country);
  const nombre = firstName(order.buyer.fullName);
  const boletos = order.ticketNumbers;
  const kind = kindOf(order.status);

  // Contexto de las plantillas. El tiempo restante se calcula al tocar.
  const context = useMemo(() => {
    const eventNumber = eventNumberOf(order.eventLabel);
    // Si la venta fue de un vendedor, el link conserva su atribución.
    const code = order.seller?.sellerCode ?? sellerCode;
    const datosPago = paymentBlocks(methods);
    return (now: Date): WaTemplateContext => ({
      nombre,
      rifa: order.raffleTitle,
      boletos,
      total: money(order.totalAmount),
      folio: order.code,
      tiempoRestante: timeRemaining(order.expiresAt, now),
      datosPago,
      linkVerificador: `${window.location.origin}/verificar?tel=${encodeURIComponent(order.buyer.phone.replace(/\D/g, ''))}`,
      linkRifa: code ? buildSellerRaffleUrl(eventNumber, code) : buildRaffleUrl('', eventNumber),
      fechaSorteo: drawDate ? longDrawDate(drawDate) : null,
    });
  }, [order, nombre, boletos, money, methods, drawDate, sellerCode]);

  const hasPayment = methods.length > 0 && !!paymentBlocks(methods);

  const options: Option[] = useMemo(() => {
    const now = () => new Date();
    const template = (id: Exclude<WaTemplateId, 'conversacion'>): Option => ({
      id,
      title: WA_TEMPLATES[id].titulo,
      preview: WA_TEMPLATES[id].build(context(new Date())).replace(/\*/g, '').split('\n')[0],
      href: () => waLink(phone, dial, WA_TEMPLATES[id].build(context(now()))),
    });
    const list: Option[] = [
      {
        id: 'conversacion',
        title: 'Ver conversación',
        preview: `Abre el chat con ${nombre || 'el comprador'}, sin mensaje`,
        href: () => waLink(phone, dial),
      },
    ];
    if (kind === 'apartada') {
      list.push(template('recordatorio'));
      if (hasPayment) list.push(template('datos_pago'));
    } else if (kind === 'pagada') {
      list.push(template('confirmacion'));
      if (drawDate) list.push(template('fecha_sorteo'));
    } else if (kind === 'liberada') {
      list.push(template('liberados'));
    }
    return list;
  }, [context, kind, hasPayment, drawDate, phone, dial, nombre]);

  // ── Deslizar hacia abajo para cerrar ────────────────────────────────
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<{ id: number; y: number; t: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    if (open) {
      setDragY(0);
      setLeaving(false);
    }
  }, [open]);

  const close = () => onOpenChange(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick.current = false;
    gesture.current = { id: e.pointerId, y: e.clientY, t: performance.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;
    if (!g.moved) {
      if (dy < 8) return; // solo hacia abajo; un toque normal no arrastra
      g.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragY(Math.max(0, dy));
  };
  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (!g.moved) return;
    suppressClick.current = true;
    setDragging(false);
    const dy = Math.max(0, e.clientY - g.y);
    const speed = dy / Math.max(1, performance.now() - g.t); // px/ms
    if (dy > 110 || speed > 0.6) {
      // Termina de bajar desde donde quedó el dedo y luego cierra.
      setLeaving(true);
      setDragY(window.innerHeight);
      window.setTimeout(close, 180);
    } else {
      setDragY(0);
    }
  };

  const formattedPhone = formatPhoneIntl(order.buyer.phone, order.buyer.country);
  // Una orden liberada ya no trae sus números (se desligan al liberar): folio.
  const ticketsLabel =
    boletos.length === 0
      ? `Folio ${order.code}`
      : boletos.length === 1
        ? `Boleto ${boletos[0]}`
        : `Boletos ${boletos.slice(0, 4).join(', ')}${boletos.length > 4 ? ` +${boletos.length - 4}` : ''}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-rf-fade-in data-[state=closed]:animate-rf-fade-out"
          style={{ opacity: dragY > 0 && !leaving ? Math.max(0.35, 1 - dragY / 400) : undefined }}
        />
        {/* La animación (~200 ms) va en el Content: Radix espera a que termine
            la de salida antes de desmontar. El arrastre mueve la capa interior. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // El foco va a la hoja (el lector de pantalla anuncia al comprador) y no
          // a «Cancelar», que se vería resaltado al abrir.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          style={{ animationDuration: '200ms' }}
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center outline-none data-[state=open]:animate-rf-sheet-in data-[state=closed]:animate-rf-sheet-out"
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                e.preventDefault();
                e.stopPropagation();
                suppressClick.current = false;
              }
            }}
            style={{
              transform: dragY ? `translate3d(0, ${dragY}px, 0)` : undefined,
              transition: dragging ? 'none' : 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
              touchAction: 'none',
            }}
            className="w-full max-w-[480px] space-y-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="overflow-hidden rounded-sheet bg-rf-surface shadow-float">
              <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-rf-separator" />
              {/* Encabezado: comprador, teléfono y boletos */}
              <div className="flex items-center gap-3 border-b border-rf-separator px-4 pb-3 pt-2">
                <IconTile icon={MessageCircle} size={40} round />
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate text-body font-semibold text-rf-label">
                    {order.buyer.fullName}
                  </DialogPrimitive.Title>
                  <p className="truncate text-caption tabular-nums text-rf-secondary">
                    {formattedPhone} · {ticketsLabel}
                  </p>
                </div>
              </div>

              {/* Opciones */}
              <div className="divide-y divide-rf-separator">
                {options.map((o) => (
                  <a
                    key={o.id}
                    href={o.href()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      // Enlace recalculado en el mismo toque (tiempo restante al
                      // momento); la navegación sigue sin esperas.
                      e.currentTarget.href = o.href();
                      close();
                    }}
                    className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-2.5 text-left outline-none transition-colors duration-fast active:bg-rf-fill focus-visible:bg-rf-fill"
                  >
                    <IconTile icon={ICONS[o.id]} tone={o.id === 'conversacion' ? 'soft' : 'accent'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-rf-label">{o.title}</span>
                      <span className="block truncate text-caption text-rf-secondary">{o.preview}</span>
                    </span>
                  </a>
                ))}
                {loading && kind !== 'liberada' && kind !== 'otra' && (
                  <div className="flex min-h-[60px] items-center gap-3.5 px-4" aria-hidden>
                    <span className="rf-skeleton h-[30px] w-[30px] rounded-[7px]" />
                    <span className="flex-1 space-y-1.5">
                      <span className="rf-skeleton block h-3.5 w-32 rounded" />
                      <span className="rf-skeleton block h-3 w-48 rounded" />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DialogPrimitive.Close className="flex h-[56px] w-full items-center justify-center rounded-sheet bg-rf-surface text-body font-semibold text-rf-accent shadow-float outline-none transition-colors duration-fast active:bg-rf-fill focus-visible:ring-2 focus-visible:ring-rf-accent/45">
              Cancelar
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

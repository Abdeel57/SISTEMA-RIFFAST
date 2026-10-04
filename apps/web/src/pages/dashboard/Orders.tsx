import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  ScanLine,
  Search,
  X,
  Store,
  Gift,
  Pencil,
  MapPin,
  FileText,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Ticket,
  FileCheck2,
  Unlock,
  Ban,
  CircleX,
  Receipt,
  Loader2,
  Send,
} from 'lucide-react';
import {
  formatMXN,
  formatDateTimeMX,
  timeRemaining,
  waReserveMessage,
  waTicketReadyMessage,
  buildWhatsappLink,
  dialCodeForCountry,
  ORDER_PAYMENT_METHODS,
  type OrderPaymentMethod,
  type OrderDTO,
} from '@riffast/shared';
import { orderService, type OrderFilter } from '@/services/orders';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { OrderStatusBadge } from '@/lib/statusBadges';
import { QrScanner } from '@/components/owner/QrScanner';
import { PanelIntro, PANEL_CARD, IconButton } from '@/components/owner/PanelKit';
import { HeaderAction } from '@/components/owner/AdminChrome';
import { ActionSheet, type SheetAction } from '@/components/owner/ActionSheet';
import { WhatsAppSheet } from '@/components/owner/WhatsAppSheet';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

type UrlFilter = 'pendientes' | 'pagadas' | 'todas';

const URL_TO_API: Record<UrlFilter, OrderFilter> = {
  pendientes: 'pending',
  pagadas: 'paid',
  todas: 'all',
};

const TABS: { value: UrlFilter; label: string }[] = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'pagadas', label: 'Pagadas' },
  { value: 'todas', label: 'Todas' },
];

const PAGE_SIZE = 15;
const MAX_CHIPS = 10;

// Etiqueta legible del método de pago capturado al confirmar.
const PAYMENT_METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

function ProofDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const proofsQuery = useQuery({
    queryKey: ['order-proofs', orderId],
    queryFn: () => orderService.proofs(orderId),
    enabled: open,
  });
  const proofs = proofsQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comprobante de pago</DialogTitle>
          <DialogDescription>Revisa el comprobante que envió el comprador.</DialogDescription>
        </DialogHeader>
        {proofsQuery.isLoading ? (
          <PageLoader label="Cargando comprobante..." />
        ) : proofsQuery.isError ? (
          <ErrorState onRetry={() => void proofsQuery.refetch()} retrying={proofsQuery.isFetching} />
        ) : proofs.length === 0 ? (
          <EmptyState icon={<FileText />} title="No hay comprobantes para mostrar" />
        ) : (
          <div className="flex flex-col gap-3">
            {proofs.map((proof) => {
              // Un PDF (comprobante de banca en línea) no se puede mostrar con
              // <img>: se ofrece como fila para abrirlo en otra pestaña.
              const isPdf = /\.pdf($|\?)/i.test(proof.fileUrl);
              return (
                <a
                  key={proof.id}
                  href={apiAssetUrl(proof.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rf-press block overflow-hidden rounded-control bg-rf-fill"
                >
                  {isPdf ? (
                    <div className="flex items-center gap-3 p-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-rf-danger/10 text-rf-danger">
                        <FileText className="h-6 w-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body font-semibold">Comprobante en PDF</span>
                        <span className="block text-caption text-rf-secondary">Toca para abrirlo</span>
                      </span>
                      <ExternalLink className="ml-auto h-5 w-5 shrink-0 text-rf-tertiary" />
                    </div>
                  ) : (
                    <img
                      src={apiAssetUrl(proof.fileUrl)}
                      alt="Comprobante de pago"
                      loading="lazy"
                      decoding="async"
                      className="w-full object-contain"
                    />
                  )}
                  {proof.note && <p className="p-3 text-callout text-rf-secondary">{proof.note}</p>}
                </a>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Números de boleto con límite: una orden de 200 boletos no debe hacer la
// tarjeta interminable. Se muestran los primeros y un "+N más" expandible.
function TicketChips({ numbers }: { numbers: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (numbers.length === 0) return null;
  const visible = expanded ? numbers : numbers.slice(0, MAX_CHIPS);
  const hidden = numbers.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((n) => (
        <span key={n} className="rounded-[8px] bg-rf-fill px-2 py-1 text-caption font-semibold tabular-nums text-rf-label">
          {n}
        </span>
      ))}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rf-press min-h-[30px] rounded-[8px] bg-rf-accent/10 px-2.5 text-caption font-semibold text-rf-accent"
        >
          {expanded ? 'Ver menos' : `+${hidden} más`}
        </button>
      )}
    </div>
  );
}

// Edición de los DATOS del comprador (nombre/teléfono/WhatsApp/estado) cuando el
// cliente se equivocó al capturarlos. No toca boletos ni el estado de la orden.
function EditBuyerDialog({ order, open, onOpenChange }: { order: OrderDTO; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(order.buyer.fullName);
  const [phone, setPhone] = useState(order.buyer.phone);
  const [whatsapp, setWhatsapp] = useState(order.buyer.whatsapp ?? '');
  const [country, setCountry] = useState(order.buyer.country || 'MX');
  const [state, setState] = useState(order.buyer.state ?? '');

  // Al abrir, parte siempre de los datos actuales de la orden.
  useEffect(() => {
    if (!open) return;
    setFullName(order.buyer.fullName);
    setPhone(order.buyer.phone);
    setWhatsapp(order.buyer.whatsapp ?? '');
    setCountry(order.buyer.country || 'MX');
    setState(order.buyer.state ?? '');
  }, [open, order]);

  const save = useMutation({
    mutationFn: () =>
      orderService.updateBuyer(order.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        country,
        whatsapp: whatsapp.trim(),
        state: state.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Datos del cliente actualizados');
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron guardar los datos'),
  });

  const nameError = fullName.trim().length > 0 && fullName.trim().length < 2 ? 'Escribe el nombre completo.' : undefined;
  const phoneError = phone.trim().length > 0 && phone.trim().length < 10 ? 'El teléfono debe tener 10 dígitos.' : undefined;
  const canSave = fullName.trim().length >= 2 && phone.trim().length >= 10;
  const fieldId = (k: string) => `buyer-${order.id}-${k}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar datos del cliente</DialogTitle>
          <DialogDescription>
            Corrige el nombre o el contacto si el cliente se equivocó. No cambia los boletos ni el monto.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave && !save.isPending) save.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor={fieldId('name')}>Nombre completo</Label>
            <Input
              id={fieldId('name')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-invalid={!!nameError}
            />
            {nameError && <p className="mt-1.5 text-callout text-rf-danger">{nameError}</p>}
          </div>
          <div className="grid grid-cols-[124px_1fr] gap-3">
            <div>
              <Label htmlFor={fieldId('country')}>País</Label>
              <Select id={fieldId('country')} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="MX">🇲🇽 MX</option>
                <option value="US">🇺🇸 US</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={fieldId('phone')}>Teléfono</Label>
              <Input
                id={fieldId('phone')}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="off"
                enterKeyHint="next"
                aria-invalid={!!phoneError}
              />
            </div>
          </div>
          {phoneError && <p className="-mt-2 text-callout text-rf-danger">{phoneError}</p>}
          <div>
            <Label htmlFor={fieldId('wa')}>WhatsApp (opcional)</Label>
            <Input
              id={fieldId('wa')}
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Si lo dejas vacío, se usa el teléfono"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="next"
            />
          </div>
          <div>
            <Label htmlFor={fieldId('state')}>Estado (opcional)</Label>
            <Input
              id={fieldId('state')}
              value={state}
              onChange={(e) => setState(e.target.value)}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending} loadingText="Guardando…" disabled={!canSave}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<'reject' | 'cancel' | null>(null);
  // Confirmación de pago (método + nota) y liberación de boletos.
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<OrderPaymentMethod>('efectivo');
  const [payNote, setPayNote] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');

  // Cambia el estado de la orden en caché al instante (optimista) y revierte
  // si el servidor falla: en redes lentas el panel se siente inmediato.
  const optimisticStatus = <V = void,>(status: OrderDTO['status']) => ({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueriesData<{ items: OrderDTO[] }>({ queryKey: ['orders'] });
      queryClient.setQueriesData<{ items: OrderDTO[] } | undefined>({ queryKey: ['orders'] }, (data) =>
        data
          ? { items: data.items.map((o) => (o.id === order.id ? { ...o, status } : o)) }
          : data,
      );
      return { previous };
    },
    onError: (e: unknown, _vars: V, ctx?: { previous: [QueryKey, { items: OrderDTO[] } | undefined][] }) => {
      ctx?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      onError(e);
    },
    onSettled: invalidate,
  });

  // Acciones de cobro: aplican a apartadas (RESERVED) y a las que ya subieron
  // comprobante (PENDING). Antes sólo PENDING → no se podía confirmar un apartado.
  const isPending = order.status === 'PENDING' || order.status === 'RESERVED';
  const remaining = timeRemaining(order.expiresAt);
  const waPhone = order.buyer.whatsapp ?? order.buyer.phone;
  // Lada del comprador (+52 México / +1 USA) para que el WhatsApp abra correcto.
  const buyerDial = dialCodeForCountry(order.buyer.country);
  const waMessage = waReserveMessage({
    raffleName: `${order.raffleTitle} (${order.eventLabel})`,
    ticketNumbers: order.ticketNumbers.join(', '),
    giftNumbers: order.giftNumbers.join(', '),
    total: formatMXN(order.totalAmount),
    orderCode: order.code,
  });

  // Liga al BOLETO DIGITAL del cliente (página, no descarga). Funciona con el folio
  // de la orden o con el código del boleto: ambos resuelven en /boleto/:code.
  const ticketCode = order.digitalTicketCode ?? order.code;
  const ticketUrl = `${window.location.origin}/boleto/${ticketCode}`;
  const ticketWaMessage = waTicketReadyMessage({
    raffleName: `${order.raffleTitle} (${order.eventLabel})`,
    ticketNumbers: order.ticketNumbers.join(', '),
    buyerName: order.buyer.fullName,
    ticketUrl,
  });
  // Abre el chat del cliente en WhatsApp con el mensaje + liga del boleto ya escritos.
  // Se llama dentro del gesto del clic para que el navegador no bloquee la pestaña.
  const sendTicketWa = () => {
    if (!waPhone) return;
    window.open(buildWhatsappLink(waPhone, ticketWaMessage, buyerDial), '_blank', 'noopener,noreferrer');
  };

  const markPaid = useMutation({
    mutationFn: (pay: { paymentMethod: OrderPaymentMethod; paymentNote: string }) =>
      orderService.markPaid(order.id, pay),
    ...optimisticStatus<{ paymentMethod: OrderPaymentMethod; paymentNote: string }>('PAID'),
    onSuccess: () => {
      setPayOpen(false);
      toast.success(waPhone ? 'Pagado. Boleto enviado al cliente por WhatsApp' : 'Orden marcada como pagada');
    },
  });

  // Liberar boletos (de vuelta a la venta o a apartado). Sin optimismo: cambia
  // estado + boletos, así que basta con invalidar la lista al terminar.
  const release = useMutation({
    mutationFn: (target: 'available' | 'reserved') => orderService.release(order.id, target),
    onSuccess: (_res, target) => {
      invalidate();
      setReleaseOpen(false);
      toast.success(target === 'available' ? 'Boletos liberados a la venta' : 'Orden devuelta a apartado');
    },
    onError,
  });

  const reject = useMutation({
    mutationFn: () => orderService.reject(order.id),
    ...optimisticStatus('REJECTED'),
    onSuccess: () => {
      setConfirming(null);
      toast.success('Orden rechazada');
    },
  });

  const cancel = useMutation({
    mutationFn: () => orderService.cancel(order.id),
    ...optimisticStatus('CANCELLED'),
    onSuccess: () => {
      setConfirming(null);
      toast.success('Orden cancelada');
    },
  });

  const waLink = waPhone
    ? buildWhatsappLink(waPhone, order.digitalTicketCode ? ticketWaMessage : waMessage, buyerDial)
    : null;
  const totalNumbers = order.ticketNumbers.length + order.giftNumbers.length;

  // Acciones secundarias: suben en una hoja desde abajo.
  const sheetActions: SheetAction[] = [
    { label: 'Ver comprobante', icon: FileCheck2, onSelect: () => setProofOpen(true), hidden: !order.hasProof },
    {
      label: 'Ver boleto digital',
      icon: Ticket,
      href: order.digitalTicketCode ? `/boleto/${order.digitalTicketCode}` : undefined,
      external: true,
      hidden: !order.digitalTicketCode,
    },
    { label: 'Editar datos del cliente', icon: Pencil, onSelect: () => setEditOpen(true) },
    { label: 'Liberar boletos', icon: Unlock, destructive: true, onSelect: () => setReleaseOpen(true), hidden: order.status !== 'PAID' },
    { label: 'Rechazar pago', icon: CircleX, destructive: true, onSelect: () => setConfirming('reject'), hidden: !isPending },
    { label: 'Cancelar apartado', icon: Ban, destructive: true, onSelect: () => setConfirming('cancel'), hidden: !isPending },
  ];

  return (
    <article className={cn(PANEL_CARD, 'p-4')}>
      {/* Quién y en qué estado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-body font-semibold text-rf-label">{order.buyer.fullName}</h3>
          <p className="text-callout tabular-nums text-rf-secondary">
            +{buyerDial} {order.buyer.phone}
            {order.buyer.country === 'US' && <span className="ml-1 font-semibold">🇺🇸 USA</span>}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Folio, rifa, vendedor y ubicación */}
      <div className="mt-2 space-y-1 text-caption text-rf-secondary">
        <p className="truncate">
          <span className="font-semibold tabular-nums text-rf-label">{order.code}</span> · {order.raffleTitle} ·{' '}
          {order.eventLabel}
        </p>
        <p className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 shrink-0" />
          {order.seller ? (
            <span className="truncate">
              {order.seller.name}
              {order.seller.sellerCode && <span className="ml-1 font-semibold">({order.seller.sellerCode})</span>}
            </span>
          ) : (
            <span>Venta directa</span>
          )}
          {order.buyer.state && (
            <>
              <span aria-hidden>·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{order.buyer.state}</span>
            </>
          )}
        </p>
      </div>

      {/* Boletos */}
      <div className="mt-3">
        {order.giftNumbers.length > 0 ? (
          <div className="space-y-2.5">
            <div>
              <p className="mb-1.5 text-caption font-medium text-rf-secondary">Elegidos</p>
              <TicketChips numbers={order.ticketNumbers} />
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-caption font-medium text-rf-accent">
                <Gift className="h-3.5 w-3.5" /> Regalo ({order.giftNumbers.length})
              </p>
              <TicketChips numbers={order.giftNumbers} />
            </div>
            <p className="text-caption text-rf-secondary">
              Números participantes: <span className="font-semibold text-rf-label">{totalNumbers}</span> ·{' '}
              {order.opportunities} oportunidades por boleto
            </p>
          </div>
        ) : (
          <TicketChips numbers={order.ticketNumbers} />
        )}
      </div>

      {/* Total y tiempo */}
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-rf-separator pt-3">
        <div className="min-w-0">
          <p className="text-heading tabular-nums text-rf-label">{formatMXN(order.totalAmount)}</p>
          <p className="text-caption text-rf-secondary">{formatDateTimeMX(order.createdAt)}</p>
        </div>
        {isPending && remaining && (
          <span className="shrink-0 rounded-full bg-rf-warning/[0.12] px-2.5 py-1 text-caption font-semibold text-rf-warning">
            Vence en {remaining}
          </span>
        )}
      </div>

      {order.paymentMethod && (
        <p className="mt-2 text-caption text-rf-secondary">
          Pagado en{' '}
          <span className="font-semibold text-rf-label">
            {PAYMENT_METHOD_LABEL[order.paymentMethod as OrderPaymentMethod] ?? order.paymentMethod}
          </span>
          {order.paymentNote ? ` · ${order.paymentNote}` : ''}
        </p>
      )}

      {isPending && order.hasProof && (
        <button
          type="button"
          onClick={() => setProofOpen(true)}
          className="rf-press mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-control bg-rf-accent/[0.08] px-3 text-left text-callout font-medium text-rf-accent"
        >
          <FileCheck2 className="h-5 w-5 shrink-0" />
          <span className="flex-1">Subió su comprobante</span>
          <span className="font-semibold">Ver</span>
        </button>
      )}

      {/* Acción principal a la vista; WhatsApp a un toque; el resto en «⋯». */}
      <div className="mt-3 flex items-center gap-2">
        {isPending ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            loading={markPaid.isPending}
            loadingText="Confirmando…"
            // Doble confirmación: abre la hoja para capturar cómo se pagó antes
            // de confirmar (evita marcar pagado por accidente).
            onClick={() => setPayOpen(true)}
          >
            Marcar pagado
          </Button>
        ) : order.digitalTicketCode && waLink ? (
          <Button asChild variant="secondary" size="sm" className="flex-1">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Send className="h-[18px] w-[18px]" />
              Enviar boleto
            </a>
          </Button>
        ) : (
          <div className="flex-1" />
        )}
        {/* WhatsApp: hoja con mensajes listos según el estado de la orden. */}
        {waPhone && (
          <button
            type="button"
            onClick={() => setWaOpen(true)}
            aria-label="Mensajes de WhatsApp"
            title="Mensajes de WhatsApp"
            className="rf-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rf-fill text-rf-label outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45"
          >
            <MessageCircle className="h-[22px] w-[22px]" />
          </button>
        )}
        <IconButton icon={MoreHorizontal} label="Más acciones" onClick={() => setMenuOpen(true)} />
      </div>

      <ActionSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={order.buyer.fullName}
        description={`${order.code} · ${formatMXN(order.totalAmount)}`}
        actions={sheetActions}
      />

      {waPhone && <WhatsAppSheet order={order} open={waOpen} onOpenChange={setWaOpen} />}
      {order.hasProof && <ProofDialog orderId={order.id} open={proofOpen} onOpenChange={setProofOpen} />}
      <EditBuyerDialog order={order} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirming === 'reject'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="¿Rechazar este pago?"
        description={
          <>
            La orden <span className="font-semibold text-rf-label">{order.code}</span> de{' '}
            <span className="font-semibold text-rf-label">{order.buyer.fullName}</span> se marcará como rechazada y
            sus boletos volverán a estar disponibles. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, rechazar"
        destructive
        loading={reject.isPending}
        onConfirm={() => reject.mutate()}
      />
      <ConfirmDialog
        open={confirming === 'cancel'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="¿Cancelar este apartado?"
        description={
          <>
            La orden <span className="font-semibold text-rf-label">{order.code}</span> de{' '}
            <span className="font-semibold text-rf-label">{order.buyer.fullName}</span> se cancelará y sus boletos
            volverán a estar disponibles. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, cancelar apartado"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />

      {/* Doble confirmación de pago: captura cómo pagó el cliente antes de marcar. */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
            <DialogDescription>
              ¿Confirmas que <span className="font-semibold text-rf-label">{order.buyer.fullName}</span> ya pagó{' '}
              <span className="font-semibold text-rf-label">{formatMXN(order.totalAmount)}</span>? Indica cómo pagó.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`pay-method-${order.id}`}>¿Cómo pagó?</Label>
              <Select
                id={`pay-method-${order.id}`}
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as OrderPaymentMethod)}
              >
                {ORDER_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`pay-note-${order.id}`}>Detalles (opcional)</Label>
              <Input
                id={`pay-note-${order.id}`}
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Referencia, banco, quién recibió…"
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
            {waPhone && (
              <p className="text-caption text-rf-secondary">
                Al confirmar se abre WhatsApp con el boleto listo para enviárselo al cliente.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={markPaid.isPending}
              loadingText="Confirmando…"
              // El WhatsApp se abre dentro del gesto del clic (no lo bloquea el navegador).
              onClick={() => {
                sendTicketWa();
                markPaid.mutate({ paymentMethod: payMethod, paymentNote: payNote.trim() });
              }}
            >
              Sí, confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liberar boletos: de vuelta a la venta o a apartado. */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar boletos</DialogTitle>
            <DialogDescription>
              Elige qué hacer con los {totalNumbers} números de la orden{' '}
              <span className="font-semibold text-rf-label">{order.code}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(
              [
                {
                  target: 'reserved' as const,
                  title: 'Volver a apartado',
                  desc: 'El cliente conserva sus boletos, pero la orden queda pendiente de pago.',
                  danger: false,
                },
                {
                  target: 'available' as const,
                  title: 'Liberar a la venta',
                  desc: 'Los boletos vuelven a estar disponibles para cualquiera. La orden se cancela.',
                  danger: true,
                },
              ]
            ).map((opt) => {
              const busy = release.isPending && release.variables === opt.target;
              return (
                <button
                  key={opt.target}
                  type="button"
                  disabled={release.isPending}
                  onClick={() => release.mutate(opt.target)}
                  className="rf-row flex w-full items-center gap-3 rounded-control bg-rf-fill px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-body font-semibold', opt.danger ? 'text-rf-danger' : 'text-rf-label')}>
                      {opt.title}
                    </span>
                    <span className="mt-0.5 block text-callout text-rf-secondary">{opt.desc}</span>
                  </span>
                  {busy && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-rf-secondary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReleaseOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export default function Orders() {
  const params = useParams<{ filter?: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isSeller = role === 'SELLER';
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState('');
  // La búsqueda viaja al backend con un retraso para no consultar en cada tecla.
  // El backend busca por folio, nombre, teléfono, rifa y NÚMERO DE BOLETO (así
  // encuentra la orden aunque sea vieja, no solo entre las recientes cargadas).
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  // Filtro por vendedor (solo admin): 'all' | 'direct' | <sellerId>.
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const urlFilter: UrlFilter =
    params.filter && params.filter in URL_TO_API ? (params.filter as UrlFilter) : 'pendientes';
  const apiFilter = URL_TO_API[urlFilter];

  const ordersQuery = useQuery({
    queryKey: ['orders', apiFilter, debouncedSearch],
    queryFn: () => orderService.list(apiFilter, undefined, debouncedSearch || undefined),
    // Mantiene la lista anterior mientras llega la búsqueda nueva (sin parpadeo).
    placeholderData: (prev) => prev,
  });

  const orders = ordersQuery.data?.items ?? [];

  // Vendedores presentes en las órdenes cargadas (para el desplegable de filtro).
  const sellerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.seller) map.set(o.seller.id, o.seller.sellerCode ? `${o.seller.name} (${o.seller.sellerCode})` : o.seller.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  // Filtro instantáneo del cliente (folio, nombre, teléfono, rifa y número de
  // boleto manual o de regalo) sobre lo ya cargado, + filtro por vendedor. La
  // búsqueda completa la hace el backend; esto solo afina al instante mientras se teclea.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (sellerFilter === 'direct' && o.seller) return false;
      if (sellerFilter !== 'all' && sellerFilter !== 'direct' && o.seller?.id !== sellerFilter) return false;
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.buyer.fullName.toLowerCase().includes(q) ||
        o.buyer.phone.toLowerCase().includes(q) ||
        o.raffleTitle.toLowerCase().includes(q) ||
        o.ticketNumbers.some((t) => t.includes(q)) ||
        o.giftNumbers.some((t) => t.includes(q))
      );
    });
  }, [orders, search, sellerFilter]);

  // Render incremental: con cientos de órdenes el DOM no se desploma.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [urlFilter, search, sellerFilter]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div>
      <HeaderAction label="Validar boleto" icon={ScanLine} onClick={() => setScanOpen(true)} />
      <PanelIntro
        description={
          isSeller ? 'Estas son las ventas generadas con tu link.' : 'Administra los apartados y pagos de tus rifas.'
        }
      />
      <QrScanner open={scanOpen} onOpenChange={setScanOpen} />

      <Tabs value={urlFilter} onValueChange={(v) => navigate(`/admin/ordenes/${v}`)}>
        <TabsList aria-label="Filtrar órdenes">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Búsqueda */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-rf-secondary" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Boleto, nombre, teléfono, folio o rifa"
          aria-label="Buscar órdenes"
          className="h-11 bg-rf-fill-strong pl-10 pr-11 focus:bg-rf-surface [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
          enterKeyHint="search"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setSearch('')}
            className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-rf-tertiary outline-none active:opacity-50"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-rf-tertiary text-white">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </button>
        )}
      </div>

      {/* Filtro por vendedor (solo administradores). */}
      {!isSeller && sellerOptions.length > 0 && (
        <div className="mt-3">
          <Select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            aria-label="Filtrar por vendedor"
            className="h-11 bg-rf-fill-strong focus:bg-rf-surface"
          >
            <option value="all">Todos los vendedores</option>
            <option value="direct">Venta directa (sin vendedor)</option>
            {sellerOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mt-4">
        {ordersQuery.isLoading ? (
          <PageLoader label="Cargando órdenes..." />
        ) : ordersQuery.isError && orders.length === 0 ? (
          <ErrorState
            title="No pudimos cargar las órdenes"
            description={ordersQuery.error instanceof ApiError ? ordersQuery.error.message : undefined}
            onRetry={() => void ordersQuery.refetch()}
            retrying={ordersQuery.isFetching}
          />
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyState
              icon={<Search />}
              title="Sin resultados"
              description={`Ninguna orden coincide con "${search}". Prueba con el folio, nombre o teléfono.`}
            />
          ) : (
            <EmptyState
              icon={<Receipt />}
              title="Sin órdenes por aquí"
              description="Cuando alguien aparte boletos, sus órdenes aparecerán en esta lista."
            />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
              {visible.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Cargar más ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListPlus, User, Hash, Gift } from 'lucide-react';
import { TICKET_STATUS_LABELS, dialCodeForCountry, type TicketStatus } from '@riffast/shared';
import { raffleService } from '@/services/raffles';
import { ticketService } from '@/services/tickets';
import { ApiError } from '@/lib/api';
import { decodeTicketMap, applyTicketChanges, type TicketMapData } from '@/lib/ticketMap';
import { useTicketChanges } from '@/lib/pwa/useTicketChanges';
import { PanelIntro, PANEL_CARD } from '@/components/owner/PanelKit';
import { HeaderAction } from '@/components/owner/AdminChrome';
import { TicketGrid } from '@/components/TicketGrid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/label';
import { TicketStatusBadge } from '@/lib/statusBadges';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { toast } from 'sonner';

// Parsea "1,2,3" y rangos "10-15" a una lista de números únicos ordenados.
function parseTicketNumbers(input: string): number[] {
  const set = new Set<number>();
  for (const raw of input.split(/[,\n;\s]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let n = lo; n <= hi; n++) set.add(n);
    } else if (/^\d+$/.test(token)) {
      set.add(Number(token));
    }
  }
  return [...set].sort((a, b) => a - b);
}

export default function RaffleTickets() {
  const { id } = useParams<{ id: string }>();
  const raffleId = id as string;
  const queryClient = useQueryClient();

  // Número del boleto abierto en el diálogo; su detalle se pide bajo demanda.
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const { data: raffleData, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });

  // Mapa compacto (1 byte por boleto): escala a 1,000,000 de boletos.
  const mapQuery = useQuery({
    queryKey: ['owner-ticket-map', raffleId],
    queryFn: () => raffleService.ownerTicketMap(raffleId),
  });
  const [ticketMap, setTicketMap] = useState<TicketMapData | null>(null);
  useEffect(() => {
    if (mapQuery.data) setTicketMap(decodeTicketMap(mapQuery.data));
  }, [mapQuery.data]);

  const raffle = raffleData?.raffle;

  // Detalle del boleto seleccionado (comprador/orden), solo cuando se abre.
  const detailQuery = useQuery({
    queryKey: ['owner-ticket', raffleId, selectedNumber],
    queryFn: () => raffleService.ownerTicket(raffleId, selectedNumber!),
    enabled: selectedNumber !== null,
  });
  const selected = selectedNumber !== null ? (detailQuery.data?.ticket ?? null) : null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['owner-ticket-map', raffleId] });
    void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
  }

  // Tiempo real (contrato C2): los cambios incrementales parchan el mapa en
  // memoria (sin recargar todos los boletos) y refrescan los conteos.
  useTicketChanges(
    raffleId,
    (items) => {
      setTicketMap((m) => (m ? applyTicketChanges(m, items) : m));
      void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
    },
    selectedNumber === null && !bulkOpen,
  );

  const setStatus = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      ticketService.setStatus(ticketId, status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'RIFERO_RESERVED' ? 'Boleto reservado para ti.' : 'Boleto liberado.',
      );
      invalidate();
      setSelectedNumber(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar el boleto'),
  });

  const reserveManual = useMutation({
    mutationFn: (numbers: number[]) => ticketService.reserveManual(raffleId, numbers),
    onSuccess: (res) => {
      toast.success(`${res.reserved} boleto(s) reservado(s) para ti.`);
      invalidate();
      setBulkOpen(false);
      setBulkText('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron reservar los boletos'),
  });

  function handleBulkSubmit() {
    const numbers = parseTicketNumbers(bulkText);
    if (numbers.length === 0) {
      toast.error('Escribe al menos un número de boleto válido.');
      return;
    }
    reserveManual.mutate(numbers);
  }

  const parsedPreview = useMemo(() => parseTicketNumbers(bulkText), [bulkText]);

  if (loadingRaffle || (!ticketMap && !mapQuery.isError)) {
    return <PageLoader label="Cargando boletos..." />;
  }

  if (mapQuery.isError || !raffle || !ticketMap) {
    return (
      <ErrorState
        title="No pudimos cargar los boletos"
        onRetry={invalidate}
        retrying={mapQuery.isFetching}
      />
    );
  }

  return (
    <div>
      <HeaderAction label="Reservar varios" icon={ListPlus} onClick={() => setBulkOpen(true)} />
      {/* El título y el regreso viven en la barra del panel. */}
      <PanelIntro description={`${raffle.eventLabel} · ${raffle.title}`} />

      {/* Resumen de conteos: los números clave, grandes. Se actualizan en vivo. */}
      <div className={cn(PANEL_CARD, 'mb-4 grid grid-cols-3 divide-x divide-rf-separator py-2')}>
        {[
          { label: 'Vendidos', value: raffle.soldCount, tone: 'text-rf-info' },
          { label: 'Apartados', value: raffle.reservedCount, tone: 'text-rf-warning' },
          { label: 'Disponibles', value: raffle.availableCount, tone: 'text-rf-accent' },
        ].map((c) => (
          <div key={c.label} className="min-w-0 px-2 py-1.5 text-center">
            <p className={cn('truncate text-heading tabular-nums', c.tone)}>{c.value.toLocaleString('es-MX')}</p>
            <p className="mt-0.5 text-caption text-rf-secondary">{c.label}</p>
          </div>
        ))}
      </div>

      <TicketGrid map={ticketMap} onTicketClick={(t) => setSelectedNumber(t.number)} />

      {/* Dialog de boleto individual (el detalle se carga bajo demanda) */}
      <Dialog open={selectedNumber !== null} onOpenChange={(open) => !open && setSelectedNumber(null)}>
        <DialogContent>
          {selectedNumber !== null && detailQuery.isLoading && <PageLoader label="Cargando boleto..." />}
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 tabular-nums">
                  <Hash className="h-5 w-5 text-rf-secondary" />
                  Boleto {selected.displayNumber}
                </DialogTitle>
                <DialogDescription>Información y acciones del boleto.</DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-control ring-1 ring-inset ring-rf-separator [&>*+*]:border-t [&>*+*]:border-rf-separator">
                <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2">
                  <span className="text-body text-rf-label">Estado</span>
                  <TicketStatusBadge status={selected.status as TicketStatus} />
                </div>

                {/* Oportunidades: marca de regalo + boleto manual que lo generó */}
                {selected.isGift && (
                  <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 text-body font-medium text-rf-accent">
                      <Gift className="h-5 w-5" /> Boleto de regalo
                    </span>
                    {selected.parentDisplayNumber && (
                      <span className="text-callout text-rf-secondary">
                        de <span className="font-semibold tabular-nums text-rf-label">{selected.parentDisplayNumber}</span>
                      </span>
                    )}
                  </div>
                )}

                {selected.buyer ? (
                  <div className="grid gap-0.5 px-4 py-3">
                    <p className="inline-flex items-center gap-1.5 text-body font-semibold text-rf-label">
                      <User className="h-5 w-5 text-rf-secondary" />
                      {selected.buyer.fullName}
                    </p>
                    <p className="text-callout tabular-nums text-rf-secondary">
                      +{dialCodeForCountry(selected.buyer.country)} {selected.buyer.phone}
                    </p>
                    {selected.buyer.state && <p className="text-callout text-rf-secondary">{selected.buyer.state}</p>}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-callout text-rf-secondary">
                    Este boleto está {TICKET_STATUS_LABELS[selected.status as TicketStatus].toLowerCase()} y no
                    tiene comprador asignado.
                  </p>
                )}
              </div>

              <DialogFooter>
                {selected.status === 'AVAILABLE' && (
                  <Button
                    variant="default"
                    loading={setStatus.isPending}
                    loadingText="Reservando…"
                    onClick={() =>
                      setStatus.mutate({ ticketId: selected.id, status: 'RIFERO_RESERVED' })
                    }
                  >
                    Reservar para mí
                  </Button>
                )}
                {selected.status === 'RIFERO_RESERVED' && (
                  <Button
                    variant="secondary"
                    loading={setStatus.isPending}
                    loadingText="Liberando…"
                    onClick={() => setStatus.mutate({ ticketId: selected.id, status: 'AVAILABLE' })}
                  >
                    Liberar boleto
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setSelectedNumber(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog reservar varios */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar varios boletos</DialogTitle>
            <DialogDescription>
              Escribe los números separados por coma. Puedes usar rangos, por ejemplo: 1, 5, 10-20.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="bulk">Números de boleto</Label>
            <Textarea
              id="bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Ej. 1, 2, 3, 10-25"
              // Teclado normal a propósito: el numérico de iPhone no tiene coma
              // ni guion y no dejaría escribir listas ni rangos.
              autoComplete="off"
              spellCheck={false}
              className="tabular-nums"
            />
            <p className="mt-1.5 text-caption text-rf-secondary" aria-live="polite">
              {parsedPreview.length > 0
                ? `Se reservarán ${parsedPreview.length} boleto(s) disponibles para ti.`
                : 'Aún no hay números válidos.'}
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={reserveManual.isPending}
              loadingText="Reservando…"
              disabled={parsedPreview.length === 0}
              onClick={handleBulkSubmit}
            >
              Reservar {parsedPreview.length > 0 ? parsedPreview.length : ''} boletos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, X, Play, Award, CheckCircle2, Info, Video, Upload, Trash2, RotateCcw } from 'lucide-react';
import {
  formatTicketNumber,
  dialCodeForCountry,
  type WinnerDTO,
  type DrawInput,
} from '@riffast/shared';
import { raffleService } from '@/services/raffles';
import { winnerService } from '@/services/winners';
import { uploadService } from '@/services/uploads';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { PanelIntro, IconButton } from '@/components/owner/PanelKit';
import { ToggleRow } from '@/components/owner/List';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface PrizeRow {
  position: number;
  prizeDescription: string;
}

function WinnerCard({ winner, raffleId }: { winner: WinnerDTO; raffleId: string }) {
  const queryClient = useQueryClient();
  const setPublished = useMutation({
    mutationFn: (published: boolean) => winnerService.setPublished(winner.id, published),
    onSuccess: (_data, published) => {
      toast.success(published ? 'Ganador publicado.' : 'Ganador oculto.');
      void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <Badge variant="warning">
          <Award /> Lugar #{winner.position}
        </Badge>
        <p className="mt-2 text-title tabular-nums text-rf-label">{winner.ticketDisplayNumber}</p>
        {winner.prizeDescription && <p className="mt-0.5 text-callout text-rf-secondary">{winner.prizeDescription}</p>}
        <p className="mt-2 text-body font-semibold text-rf-label">{winner.buyer?.fullName ?? 'Sin comprador asignado'}</p>
        {winner.buyer?.phone && (
          <p className="text-callout tabular-nums text-rf-secondary">
            +{dialCodeForCountry(winner.buyer.country)} {winner.buyer.phone}
          </p>
        )}
      </div>
      <div className="border-t border-rf-separator">
        <ToggleRow
          id={`publish-${winner.id}`}
          title="Publicar ganador"
          description="Visible en tu página pública."
          checked={winner.published}
          disabled={setPublished.isPending}
          onCheckedChange={(v) => setPublished.mutate(v)}
        />
      </div>
    </Card>
  );
}

// Subir / mostrar el video del sorteo (se guarda en el volumen de Railway).
function DrawEvidence({ raffleId, currentUrl }: { raffleId: string; currentUrl: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (url: string) => winnerService.setEvidence(raffleId, url),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar el video'),
  });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Selecciona un video (MP4, WEBM o MOV)');
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadService.video(file, 'evidence');
      await save.mutateAsync(url);
      toast.success('Video del sorteo guardado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo subir el video');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-rf-accent" /> Video del sorteo
        </CardTitle>
        <CardDescription>Opcional. Sube la transmisión o evidencia para dar confianza a tus compradores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentUrl && (
          <video src={apiAssetUrl(currentUrl)} controls playsInline className="w-full rounded-control bg-black" />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={uploading}
            loading={uploading}
            loadingText="Subiendo video…"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            {currentUrl ? 'Cambiar video' : 'Subir video'}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-rf-danger active:bg-rf-danger/10"
              disabled={uploading || save.isPending}
              onClick={() => save.mutate('')}
            >
              <Trash2 className="h-5 w-5" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-caption text-rf-secondary">Máximo 50 MB · MP4, WEBM o MOV.</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function RaffleDraw() {
  const { id } = useParams<{ id: string }>();
  const raffleId = id as string;
  const queryClient = useQueryClient();

  const [prizes, setPrizes] = useState<PrizeRow[]>([{ position: 1, prizeDescription: '' }]);
  const [allowRepeatWinner, setAllowRepeatWinner] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);

  // Tómbola
  const [spinning, setSpinning] = useState(false);
  const [spinValue, setSpinValue] = useState('');
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingWinners, setPendingWinners] = useState<WinnerDTO[] | null>(null);

  const { data: raffleData, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });

  const { data: winnersData, isLoading: loadingWinners } = useQuery({
    queryKey: ['winners', raffleId],
    queryFn: () => winnerService.list(raffleId),
  });

  const raffle = raffleData?.raffle;
  const existingWinners = winnersData?.items ?? [];
  const alreadyDrawn = existingWinners.length > 0;

  useEffect(() => {
    return () => {
      if (spinRef.current) clearInterval(spinRef.current);
    };
  }, []);

  function addPrize() {
    setPrizes((prev) => [...prev, { position: prev.length + 1, prizeDescription: '' }]);
  }

  function removePrize(index: number) {
    setPrizes((prev) => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i + 1 })));
  }

  function updatePrize(index: number, value: string) {
    setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, prizeDescription: value } : p)));
  }

  function startTombola(winners: WinnerDTO[]) {
    const padding = raffle?.ticketFormat ?? 3;
    setSpinning(true);
    setPendingWinners(winners);
    spinRef.current = setInterval(() => {
      const max = raffle?.totalTickets ?? 999;
      const start = raffle?.ticketStart ?? 0;
      const rnd = start + Math.floor(Math.random() * Math.max(1, max));
      setSpinValue(formatTicketNumber(rnd, padding));
    }, 60);

    setTimeout(() => {
      if (spinRef.current) clearInterval(spinRef.current);
      spinRef.current = null;
      // Mostrar el número del primer ganador como cierre dramático.
      setSpinValue(winners[0]?.ticketDisplayNumber ?? '');
      setTimeout(() => {
        setSpinning(false);
        setPendingWinners(null);
        void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
      }, 700);
    }, 2200);
  }

  const draw = useMutation({
    mutationFn: (input: DrawInput) => winnerService.draw(raffleId, input),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast.success('¡Sorteo realizado!');
      startTombola(res.winners);
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error(e instanceof ApiError ? e.message : 'No se pudo realizar el sorteo');
    },
  });

  // Salida de emergencia para un sorteo lanzado por accidente. Revierte las
  // tres cosas que hace el sorteo; las ventas y los pagos no se tocan.
  const undo = useMutation({
    mutationFn: () => winnerService.undoDraw(raffleId),
    onSuccess: (res) => {
      setUndoOpen(false);
      toast.success(res.reopened ? 'Sorteo deshecho. La rifa vuelve a estar abierta.' : 'Sorteo deshecho.');
      void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
      void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
    },
    onError: (e) => {
      setUndoOpen(false);
      toast.error(e instanceof ApiError ? e.message : 'No se pudo deshacer el sorteo');
    },
  });

  function handleDraw() {
    const cleaned = prizes.map((p, i) => ({
      position: i + 1,
      prizeDescription: p.prizeDescription.trim() || undefined,
    }));
    draw.mutate({ prizes: cleaned, allowRepeatWinner });
  }

  if (loadingRaffle || loadingWinners) {
    return <PageLoader label="Cargando sorteo..." />;
  }

  if (!raffle) {
    return (
      <ErrorState
        title="No pudimos cargar la rifa"
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] })}
      />
    );
  }

  return (
    <div>
      {/* El título y el regreso viven en la barra del panel. */}
      <PanelIntro description={`${raffle.eventLabel} · ${raffle.title}`} />

      {/* Aviso: solo boletos pagados */}
      <Card className="mb-4">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-rf-accent" />
          <div>
            <p className="text-body font-semibold text-rf-label">En el sorteo solo participan boletos pagados.</p>
            <p className="mt-0.5 text-callout text-rf-secondary">
              Tienes <strong className="font-semibold tabular-nums text-rf-label">{raffle.soldCount.toLocaleString('es-MX')}</strong>{' '}
              boleto(s) pagado(s) que participan.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Animación tómbola */}
      {spinning && (
        <Card className="mb-4 animate-rf-rise">
          <CardContent className="grid place-items-center gap-2 py-8" aria-live="polite">
            <Trophy className="h-8 w-8 animate-bounce text-rf-warning" />
            <p className="text-callout font-semibold text-rf-secondary">Sorteando…</p>
            <p className="text-title tabular-nums text-rf-label">
              {spinValue || '---'}
            </p>
            {pendingWinners && pendingWinners.length > 1 && (
              <p className="text-caption text-rf-secondary">{pendingWinners.length} ganadores en juego</p>
            )}
          </CardContent>
        </Card>
      )}

      {alreadyDrawn ? (
        /* Resultados existentes */
        <div className="grid gap-3">
          <div className="flex items-center gap-2 px-1 text-callout font-semibold text-rf-accent">
            <CheckCircle2 className="h-5 w-5" />
            Este sorteo ya se realizó.
          </div>
          {existingWinners
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((w) => (
              <WinnerCard key={w.id} winner={w} raffleId={raffleId} />
            ))}
          <DrawEvidence raffleId={raffleId} currentUrl={existingWinners[0]?.evidenceUrl ?? null} />

          {/* Va al final y en tono discreto: deshacer es una corrección, no un
              paso normal del flujo. */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-body font-medium text-rf-label">¿Sorteaste por error?</p>
                <p className="mt-0.5 text-caption text-rf-secondary">
                  Borra {existingWinners.length === 1 ? 'al ganador' : `a los ${existingWinners.length} ganadores`}, devuelve
                  sus boletos a "pagado" y reabre la rifa para seguir vendiendo.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 text-rf-danger active:bg-rf-danger/10"
                loading={undo.isPending}
                onClick={() => setUndoOpen(true)}
              >
                <RotateCcw className="h-5 w-5" />
                Deshacer sorteo
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Configurador del sorteo */
        <Card>
          <CardHeader>
            <CardTitle>Configura los premios</CardTitle>
            <CardDescription>Agrega una posición por cada ganador que vas a sortear.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              {prizes.map((p, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="grid h-[50px] w-12 shrink-0 place-items-center rounded-control bg-rf-accent/10 text-body font-semibold tabular-nums text-rf-accent">
                    #{p.position}
                  </div>
                  <div className="min-w-0 flex-1">
                    {i === 0 && <Label htmlFor={`prize-${i}`}>Descripción del premio (opcional)</Label>}
                    <Input
                      id={`prize-${i}`}
                      value={p.prizeDescription}
                      onChange={(e) => updatePrize(i, e.target.value)}
                      placeholder={i === 0 ? 'Ej. Premio mayor: la camioneta' : 'Ej. 2do premio: $5,000'}
                      enterKeyHint="next"
                      aria-label={i === 0 ? undefined : `Premio del lugar ${p.position}`}
                    />
                  </div>
                  {prizes.length > 1 && (
                    <IconButton
                      icon={X}
                      label={`Quitar premio #${p.position}`}
                      tone="accent"
                      className="mb-[3px] text-rf-danger active:bg-rf-danger/10"
                      onClick={() => removePrize(i)}
                    />
                  )}
                </div>
              ))}
            </div>

            <Button type="button" variant="secondary" onClick={addPrize} disabled={prizes.length >= 100}>
              <Plus className="h-5 w-5" />
              Agregar premio
            </Button>

            <div className="-mx-4 border-y border-rf-separator">
              <ToggleRow
                id="allowRepeatWinner"
                title="Permitir que un boleto gane más de una vez"
                description="Si lo activas, un mismo número podría salir en varias posiciones."
                checked={allowRepeatWinner}
                onCheckedChange={setAllowRepeatWinner}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              loading={draw.isPending || spinning}
              loadingText="Sorteando…"
              disabled={raffle.soldCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Play className="h-5 w-5" />
              Iniciar sorteo
            </Button>
            {raffle.soldCount === 0 && (
              <p role="alert" className="text-center text-callout text-rf-danger">
                No hay boletos pagados. No se puede realizar el sorteo todavía.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* El sorteo es definitivo: confirmar antes de tirar la tómbola. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Iniciar el sorteo?"
        description={
          <>
            Se elegirá{prizes.length > 1 ? 'n' : ''}{' '}
            <span className="font-semibold text-foreground">
              {prizes.length} ganador{prizes.length > 1 ? 'es' : ''}
            </span>{' '}
            al azar entre los{' '}
            <span className="font-semibold text-foreground">
              {raffle.soldCount.toLocaleString('es-MX')} boletos pagados
            </span>
            . Si te equivocas, puedes deshacerlo después desde esta misma pantalla.
          </>
        }
        confirmLabel="Sí, sortear ahora"
        loading={draw.isPending}
        onConfirm={handleDraw}
      />

      <ConfirmDialog
        open={undoOpen}
        onOpenChange={setUndoOpen}
        destructive
        title="¿Deshacer el sorteo?"
        description={
          <>
            Se borrará{existingWinners.length > 1 ? 'n' : ''}{' '}
            <span className="font-semibold text-foreground">
              {existingWinners.length} ganador{existingWinners.length > 1 ? 'es' : ''}
            </span>{' '}
            y la rifa volverá a estar abierta para vender. Las ventas, los pagos y los boletos ya
            comprados no se tocan. Si ya publicaste al ganador, dejará de verse en tu página.
          </>
        }
        confirmLabel="Sí, deshacer"
        loading={undo.isPending}
        onConfirm={() => undo.mutate()}
      />
    </div>
  );
}

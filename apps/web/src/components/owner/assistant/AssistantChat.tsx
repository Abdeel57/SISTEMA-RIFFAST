import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Camera, MessageCircle, PhoneCall, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  assistantService,
  type ActionView,
  type AssistantStatus,
  type ChatItem,
  type MessageResponse,
  type OutgoingImage,
} from '@/services/assistant';
import { ActionCard, CallCard, TypingBubble } from './ActionCard';
import { ChatMarkdown } from './ChatMarkdown';
import { compressImage, type PreparedImage } from './compressImage';

// Chat de «Asistencia 24 h» (con IA). Vive dentro de la hoja existente.

const MAX_CHARS = 2000;
const MAX_PHOTOS = 2;
const LINE = 22; // px por línea del campo de texto
const MAX_LINES = 5;

interface Props {
  status: AssistantStatus;
  onInternalLink: (path: string) => void;
}

interface PendingError {
  texto: string;
  permitirLlamada: boolean;
  retry: { texto: string; imagenes: OutgoingImage[] } | null;
}

let localSeq = 0;
const localId = (p: string) => `local-${p}-${++localSeq}`;

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function AssistantChat({ status, onInternalLink }: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<PendingError | null>(null);
  const [offerCall, setOfferCall] = useState(false);
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [busy, setBusy] = useState<Record<string, 'confirm' | 'cancel'>>({});
  const [callOpen, setCallOpen] = useState(false);
  const [callPhone, setCallPhone] = useState(status.telefono);
  const [calling, setCalling] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Al abrir: carga la conversación activa.
  useEffect(() => {
    let alive = true;
    assistantService
      .conversation()
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Scroll al final con cada mensaje nuevo.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: loading ? 'auto' : 'smooth' });
  }, [items, sending, error, offerCall, callOpen, loading]);

  // Campo de texto que crece hasta 5 líneas.
  const autosize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, LINE * MAX_LINES + 20)}px`;
  }, []);
  useLayoutEffect(autosize, [draft, autosize]);

  const applyResponse = (res: MessageResponse, retry: PendingError['retry']) => {
    const next: ChatItem[] = [];
    const now = new Date().toISOString();
    if (res.estado === 'ok' && res.texto.trim()) {
      next.push({ tipo: 'mensaje', id: localId('a'), rol: 'assistant', texto: res.texto, fecha: now });
    }
    for (const a of res.acciones ?? []) next.push({ tipo: 'accion', ...a });
    if (res.llamada) next.push({ tipo: 'llamada', ...res.llamada });
    if (next.length) setItems((prev) => [...prev, ...next]);

    if (res.estado === 'ok') {
      setError(null);
      setOfferCall(!!res.permitirLlamada);
    } else {
      setOfferCall(false);
      setError({ texto: res.texto, permitirLlamada: !!res.permitirLlamada, retry: res.estado === 'error' ? retry : null });
    }
  };

  const send = async (texto: string, imgs: PreparedImage[], isRetry = false) => {
    const clean = texto.trim().slice(0, MAX_CHARS);
    if ((!clean && !imgs.length) || sending) return;
    const imagenes: OutgoingImage[] = imgs.map((p) => ({ mimeType: p.mimeType, data: p.data }));
    const tempId = localId('u');
    if (!isRetry) {
      setItems((prev) => [
        ...prev,
        { tipo: 'mensaje', id: tempId, rol: 'user', texto: clean, fecha: new Date().toISOString(), fotos: imgs.map((p) => p.preview) },
      ]);
      setDraft('');
      setPhotos([]);
    }
    setError(null);
    setOfferCall(false);
    setCallOpen(false);
    setSending(true);
    try {
      const res = await assistantService.send({ texto: clean, imagenes, ...(isRetry ? { reintentar: true } : {}) });
      if (res.estado === 'invalido' || res.estado === 'inactivo') {
        // No se mandó: el texto regresa a la caja para corregirlo.
        if (!isRetry) {
          setItems((prev) => prev.filter((i) => i.id !== tempId));
          setDraft(clean);
          setPhotos(imgs);
        }
        toast.error(res.texto || 'No se pudo enviar el mensaje');
        return;
      }
      applyResponse(res, { texto: clean, imagenes });
    } catch (e) {
      setError({
        texto:
          e instanceof ApiError && e.status !== 0 && e.status < 500
            ? e.message
            : 'No hay conexión con el asistente. Revisa tu internet e intenta de nuevo.',
        permitirLlamada: true,
        retry: { texto: clean, imagenes },
      });
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    if (!error?.retry) return;
    const { texto, imagenes } = error.retry;
    void send(texto, imagenes.map((i) => ({ mimeType: 'image/jpeg' as const, data: i.data, preview: '' })), true);
  };

  const updateAction = (accion: ActionView) =>
    setItems((prev) => prev.map((i) => (i.tipo === 'accion' && i.id === accion.id ? { tipo: 'accion', ...accion } : i)));

  const confirm = async (action: ActionView) => {
    if (busy[action.id]) return;
    // Igual que «Sí, confirmar pago» en Órdenes: WhatsApp se abre en el mismo toque.
    if (action.tarjeta.whatsapp) window.open(action.tarjeta.whatsapp.url, '_blank', 'noopener,noreferrer');
    setBusy((b) => ({ ...b, [action.id]: 'confirm' }));
    try {
      const res = await assistantService.confirm(action.id);
      updateAction(res.accion);
      if (res.estado === 'hecha') void queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo confirmar. Intenta de nuevo.');
    } finally {
      setBusy(({ [action.id]: _done, ...rest }) => rest);
    }
  };

  const cancel = async (action: ActionView) => {
    if (busy[action.id]) return;
    setBusy((b) => ({ ...b, [action.id]: 'cancel' }));
    try {
      const res = await assistantService.cancel(action.id);
      updateAction(res.accion);
      if (res.texto) {
        setItems((prev) => [...prev, { tipo: 'mensaje', id: localId('a'), rol: 'assistant', texto: res.texto, fecha: new Date().toISOString() }]);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo cancelar. Intenta de nuevo.');
    } finally {
      setBusy(({ [action.id]: _done, ...rest }) => rest);
    }
  };

  const requestCall = async () => {
    if (calling) return;
    setCalling(true);
    try {
      const res = await assistantService.requestCall(callPhone);
      // El aviso de error queda en el historial y la llamada aparece debajo.
      const errorText = error?.texto;
      setItems((prev) => {
        const next: ChatItem[] = errorText
          ? [...prev, { tipo: 'mensaje', id: localId('e'), rol: 'assistant', texto: errorText, fecha: new Date().toISOString() }]
          : [...prev];
        if (!next.some((i) => i.tipo === 'llamada' && i.id === res.llamada.id)) next.push({ tipo: 'llamada', ...res.llamada });
        return next;
      });
      setCallOpen(false);
      setOfferCall(false);
      setError(null);
      if (res.duplicada) toast.success('Ya teníamos tu llamada; el equipo ya está avisado.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo pedir la llamada. Intenta de nuevo.');
    } finally {
      setCalling(false);
    }
  };

  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error('Puedes mandar hasta 2 fotos por mensaje.');
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    try {
      const prepared = await Promise.all(chosen.map(compressImage));
      setPhotos((p) => [...p, ...prepared].slice(0, MAX_PHOTOS));
    } catch {
      toast.error('No pude leer esa foto. Prueba con otra o toma una captura de pantalla.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isCoarsePointer()) {
      e.preventDefault();
      void send(draft, photos);
    }
  };

  const canSend = (!!draft.trim() || photos.length > 0) && !sending;
  const empty = !loading && items.length === 0;
  const showCallForm = callOpen && (error?.permitirLlamada || offerCall);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mensajes */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {loading ? (
          <div className="space-y-3" aria-hidden>
            <div className="rf-skeleton h-12 w-2/3 rounded-2xl" />
            <div className="rf-skeleton ml-auto h-10 w-1/2 rounded-2xl" />
            <div className="rf-skeleton h-16 w-3/4 rounded-2xl" />
          </div>
        ) : empty ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 pb-4 text-center">
            <span className="rf-gem-soft mb-4 grid h-16 w-16 place-items-center rounded-full">
              <MessageCircle className="h-8 w-8" />
            </span>
            <h3 className="text-heading">¿En qué te ayudamos?</h3>
            <p className="mt-2 max-w-xs text-callout text-rf-secondary">
              Escríbenos y te ayudamos con tus dudas o con cambios en tu administrador, a cualquier hora.
            </p>
            <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">
              {status.sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s, [])}
                  className="rf-press min-h-[44px] rounded-full bg-rf-accent/10 px-4 text-callout font-medium text-rf-accent shadow-[inset_0_0_0_1px_rgb(var(--rf-accent)/0.14)] outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5" aria-live="polite" aria-relevant="additions">
          {items.map((item) => {
            if (item.tipo === 'accion') {
              return (
                <ActionCard
                  key={item.id}
                  action={item}
                  busy={busy[item.id] ?? null}
                  onConfirm={confirm}
                  onCancel={cancel}
                  onInternalLink={onInternalLink}
                />
              );
            }
            if (item.tipo === 'llamada') return <CallCard key={item.id} call={item} />;
            if (item.rol === 'user') {
              return (
                <div key={item.id} className="flex max-w-[85%] flex-col items-end gap-1 self-end">
                  {item.fotos?.some(Boolean) && (
                    <div className="flex gap-1.5">
                      {item.fotos.filter(Boolean).map((src, i) => (
                        <img key={i} src={src} alt="Foto enviada" className="h-20 w-20 rounded-xl object-cover" />
                      ))}
                    </div>
                  )}
                  {item.texto && (
                    <p className="whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-rf-accent px-4 py-2.5 text-[16px] leading-[22px] text-white">
                      {item.texto}
                    </p>
                  )}
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className="max-w-[88%] self-start rounded-[20px] rounded-bl-md bg-rf-fill px-4 py-2.5 text-[16px] leading-[22px] text-rf-label"
              >
                <ChatMarkdown text={item.texto} onInternalLink={onInternalLink} />
              </div>
            );
          })}

          {sending && <TypingBubble />}

          {error && (
            <div role="alert" className="max-w-[88%] self-start rounded-[20px] rounded-bl-md border border-rf-danger/20 bg-rf-danger/[0.06] px-4 py-3 text-[16px] leading-[22px] text-rf-label">
              <p>{error.texto}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {error.retry && (
                  <Button variant="secondary" size="sm" onClick={retry} disabled={sending}>
                    <RotateCcw className="h-4 w-4" /> Reintentar
                  </Button>
                )}
                {error.permitirLlamada && !callOpen && (
                  <Button variant="secondary" size="sm" onClick={() => setCallOpen(true)}>
                    <PhoneCall className="h-4 w-4" /> Pedir llamada
                  </Button>
                )}
              </div>
            </div>
          )}

          {offerCall && !error && !callOpen && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setCallOpen(true)}>
              <PhoneCall className="h-4 w-4" /> Pedir llamada
            </Button>
          )}

          {showCallForm && (
            <form
              className="w-full max-w-[92%] self-start rounded-2xl border border-rf-separator bg-rf-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void requestCall();
              }}
            >
              <label htmlFor="assist-call-phone" className="text-callout font-semibold text-rf-label">
                ¿A qué número te llamamos?
              </label>
              <input
                id="assist-call-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={callPhone}
                onChange={(e) => setCallPhone(e.target.value)}
                placeholder="662 123 4567"
                className="mt-2 h-11 w-full rounded-control bg-rf-fill px-3 text-[16px] tabular-nums text-rf-label outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45"
              />
              <div className="mt-3 flex gap-2">
                <Button type="submit" size="sm" className="flex-1" loading={calling} loadingText="Avisando…">
                  Llamarme
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCallOpen(false)} disabled={calling}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Caja de texto */}
      <div className="shrink-0 border-t border-rf-separator bg-rf-surface px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {photos.length > 0 && (
          <div className="mb-2 flex gap-2 px-1">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.preview} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label={`Quitar foto ${i + 1}`}
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -right-3 -top-3 grid h-11 w-11 place-items-center"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white">
                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          {status.imagenes && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void pickPhotos(e.target.files)}
              />
              <button
                type="button"
                aria-label="Agregar foto"
                title="Agregar foto (por ejemplo, tu tarjeta)"
                disabled={photos.length >= MAX_PHOTOS || sending}
                onClick={() => fileRef.current?.click()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-rf-secondary outline-none active:bg-rf-fill disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-rf-accent/45"
              >
                <Camera className="h-6 w-6" />
              </button>
            </>
          )}
          <label htmlFor="assist-input" className="sr-only">
            Escribe tu mensaje
          </label>
          <textarea
            id="assist-input"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_CHARS}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu mensaje…"
            enterKeyHint="send"
            className="min-h-[44px] flex-1 resize-none rounded-[22px] bg-rf-fill px-4 py-[11px] text-[16px] leading-[22px] text-rf-label outline-none placeholder:text-rf-tertiary focus-visible:ring-2 focus-visible:ring-rf-accent/45"
          />
          <button
            type="button"
            aria-label="Enviar"
            disabled={!canSend}
            onClick={() => void send(draft, photos)}
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45',
              canSend ? 'rf-gem rf-gem-raised rf-gem-press' : 'bg-rf-fill text-rf-tertiary',
            )}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
}

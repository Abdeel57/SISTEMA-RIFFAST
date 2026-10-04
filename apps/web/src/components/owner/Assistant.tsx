import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Headset, MessageCircle, X } from 'lucide-react';
import { buildWhatsappLink } from '@riffast/shared';
import { webEnv } from '@/lib/env';
import { useAuthStore } from '@/store/auth';
import { usePortalContainer } from '@/components/ui/surface';
import { cn } from '@/lib/cn';

// ── Asistencia 24 h ──────────────────────────────────────────────
// Chat de atención dentro del administrador: una burbuja flotante (que el
// rifero puede arrastrar a donde no le estorbe) abre el panel de chat.
// El chat se conecta con VITE_SUPPORT_CHAT_URL (se carga dentro del panel);
// sin ella, el panel ofrece escribir por WhatsApp a Riffast.

interface AssistantState {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const AssistantContext = createContext<AssistantState | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <AssistantContext.Provider value={value}>
      {children}
      <AssistantPanel open={open} onOpenChange={setOpen} />
    </AssistantContext.Provider>
  );
}

/** Abre el panel de Asistencia desde cualquier pantalla del panel (p. ej. «Más»). */
export function useAssistant(): { openAssistant: () => void; isOpen: boolean } {
  const ctx = useContext(AssistantContext);
  return { openAssistant: () => ctx?.setOpen(true), isOpen: ctx?.open ?? false };
}

// ── Burbuja flotante y arrastrable ────────────────────────────────
const SIZE = 56; // diámetro de la burbuja
const EDGE = 16; // separación de los bordes
const POS_KEY = 'riffast:assist-pos';

interface BubblePos {
  side: 'left' | 'right';
  lift: number; // px por encima de la línea base (sobre la barra de pestañas)
}

function readPos(): BubblePos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<BubblePos>;
      if ((p.side === 'left' || p.side === 'right') && typeof p.lift === 'number') return { side: p.side, lift: p.lift };
    }
  } catch {
    /* almacenamiento no disponible: posición por defecto */
  }
  return { side: 'right', lift: 0 };
}

function savePos(p: BubblePos): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

// Mide las zonas seguras (notch / indicador de inicio) una sola vez.
function measureSafeArea(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const res = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return res;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable]:not([contenteditable=false])');
}

/**
 * Burbuja de Asistencia. Se coloca DENTRO de un contenedor `relative` (la
 * columna del panel). `reserve` = px reservados abajo (barra de pestañas o
 * barra de guardar) para que la burbuja nunca los tape.
 */
export function AssistantBubble({ reserve }: { reserve: number }) {
  const ctx = useContext(AssistantContext);
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<BubblePos>(readPos);
  const [drag, setDrag] = useState<{ dx: number; lift: number } | null>(null);
  // Copia síncrona de `drag`: un arrastre muy rápido puede soltarse antes de
  // que React pinte el primer movimiento.
  const dragRef = useRef<{ dx: number; lift: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [typing, setTyping] = useState(false);
  const safe = useRef({ top: 0, bottom: 0 });
  const gesture = useRef<{ id: number; x: number; y: number; lift: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Tamaño del contenedor (para limitar el arrastre y pegar al borde).
  useEffect(() => {
    safe.current = measureSafeArea();
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const update = () => setBox({ w: parent.clientWidth, h: parent.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Mientras se escribe en un campo, la burbuja se aparta (no tapa el teclado
  // ni lo que se está llenando).
  useEffect(() => {
    const onIn = (e: FocusEvent) => setTyping(isTypingTarget(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // Límite superior: debajo de la barra del título (44 px + notch + margen).
  const maxLift = Math.max(0, box.h - reserve - safe.current.bottom - safe.current.top - 44 - EDGE - SIZE - EDGE);
  const clampLift = useCallback((v: number) => Math.min(Math.max(0, v), maxLift), [maxLift]);

  const lift = drag ? drag.lift : clampLift(pos.lift);
  const baseX = pos.side === 'left' ? EDGE : Math.max(EDGE, box.w - EDGE - SIZE);
  const x = baseX + (drag?.dx ?? 0);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Tras un arrastre algunos navegadores no disparan `click`: el bloqueo se
    // reinicia en cada toque nuevo para no tragarse el siguiente.
    suppressClick.current = false;
    dragRef.current = null;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lift: clampLift(pos.lift), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    if (!g.moved) {
      g.moved = true;
      ref.current?.setPointerCapture(e.pointerId);
    }
    const next = { dx, lift: clampLift(g.lift - dy) };
    dragRef.current = next;
    setDrag(next);
  };
  const endGesture = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    const d = dragRef.current;
    dragRef.current = null;
    if (!g.moved || !d) return;
    suppressClick.current = true;
    // Se pega al borde más cercano (izquierdo o derecho).
    const center = baseX + d.dx + SIZE / 2;
    const next: BubblePos = { side: center < box.w / 2 ? 'left' : 'right', lift: d.lift };
    setPos(next);
    savePos(next);
    setDrag(null);
  };

  if (!ctx || box.w === 0) {
    // Primer render: sin medidas aún, se monta invisible para poder medir.
    return <button ref={ref} type="button" aria-hidden tabIndex={-1} className="pointer-events-none absolute opacity-0" />;
  }

  const hidden = typing || ctx.open;

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Asistencia 24 horas"
      title="Asistencia 24 h · puedes arrastrarla"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        ctx.setOpen(true);
      }}
      style={{
        left: 0,
        bottom: `calc(${reserve + lift}px + env(safe-area-inset-bottom))`,
        transform: `translateX(${x}px) scale(${drag ? 1.06 : 1})`,
        touchAction: 'none',
      }}
      className={cn(
        'rf-gem rf-gem-tile rf-gem-float absolute z-40 grid h-14 w-14 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-rf-accent/30 active:brightness-95',
        drag ? 'cursor-grabbing' : 'cursor-pointer transition-[transform,bottom,opacity] duration-slow ease-ios',
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      <Headset className="h-[26px] w-[26px]" strokeWidth={2} />
    </button>
  );
}

// ── Panel del chat ────────────────────────────────────────────────
function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const container = usePortalContainer();
  const user = useAuthStore((s) => s.user);
  const [loaded, setLoaded] = useState(false);
  const chatUrl = webEnv.supportChatUrl;

  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  const waLink = webEnv.riffastWhatsapp
    ? buildWhatsappLink(
        webEnv.riffastWhatsapp,
        `¡Hola Riffast! 👋 Soy ${user?.name ?? 'un rifero'} (${window.location.host}). Necesito ayuda con mi administrador.`,
      )
    : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-rf-fade-in data-[state=closed]:animate-rf-fade-out sm:bg-black/20" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-sheet bg-rf-surface text-rf-label shadow-sheet outline-none data-[state=open]:animate-rf-sheet-in data-[state=closed]:animate-rf-sheet-out sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-sheet sm:shadow-float sm:data-[state=open]:animate-rf-rise sm:data-[state=closed]:animate-rf-fade-out"
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-rf-separator sm:hidden" />
          {/* Encabezado */}
          <div className="flex shrink-0 items-center gap-3 border-b border-rf-separator px-4 pb-3 pt-2 sm:pt-3">
            <span className="rf-gem rf-gem-tile grid h-10 w-10 shrink-0 place-items-center rounded-full">
              <Headset className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-body font-semibold leading-tight">Asistencia 24 h</DialogPrimitive.Title>
              <p className="flex items-center gap-1.5 text-caption text-rf-secondary">
                <span className="h-2 w-2 rounded-full bg-rf-accent" aria-hidden />
                Dudas y cambios en tu administrador, a cualquier hora
              </p>
            </div>
            <DialogPrimitive.Close className="grid h-11 w-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-rf-fill text-rf-secondary">
                <X className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          </div>

          {/* Cuerpo */}
          {chatUrl ? (
            <div className="relative flex-1">
              {!loaded && (
                <div className="absolute inset-0 space-y-3 p-4" aria-hidden>
                  <div className="rf-skeleton h-12 w-2/3 rounded-2xl" />
                  <div className="rf-skeleton ml-auto h-10 w-1/2 rounded-2xl" />
                  <div className="rf-skeleton h-16 w-3/4 rounded-2xl" />
                </div>
              )}
              <iframe
                src={chatUrl}
                title="Chat de Asistencia 24 horas"
                allow="clipboard-write; microphone"
                onLoad={() => setLoaded(true)}
                className={cn('h-full w-full border-0 transition-opacity duration-base', loaded ? 'opacity-100' : 'opacity-0')}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <span className="rf-gem-soft mb-4 grid h-16 w-16 place-items-center rounded-full">
                <MessageCircle className="h-8 w-8" />
              </span>
              <h3 className="text-heading">¿En qué te ayudamos?</h3>
              <p className="mt-2 max-w-xs text-callout text-rf-secondary">
                Escríbenos y te ayudamos con tus dudas o con cambios en tu administrador, a cualquier hora.
              </p>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rf-press rf-gem rf-gem-raised rf-gem-press mt-6 inline-flex h-[50px] w-full max-w-xs items-center justify-center gap-2 rounded-control px-5 text-body font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  Escribir por WhatsApp
                </a>
              ) : (
                <p className="mt-6 rounded-control bg-rf-fill px-4 py-3 text-callout text-rf-secondary">
                  El chat se activará muy pronto.
                </p>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

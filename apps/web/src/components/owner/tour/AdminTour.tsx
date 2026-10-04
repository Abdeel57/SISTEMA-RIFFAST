import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, CreditCard, Headset, Receipt, Ticket, Users, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePortalContainer } from '@/components/ui/surface';
import { useAssistant } from '@/components/owner/Assistant';
import { LogoMark } from '@/components/brand/LogoMark';
import { afterIntro } from '@/lib/intro';
import { webEnv } from '@/lib/env';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth';
import { ADMIN_STEPS, SELLER_STEPS, type TourStep } from './tourSteps';
import { PracticeOrder, type PracticePhase } from './PracticeOrder';

// ── Tutorial del administrador ─────────────────────────────────────
// Recorrido guiado que aparece la PRIMERA vez que un usuario entra al panel en
// un dispositivo. Ilumina cada sección real (pestañas en celular, menú lateral
// en computadora), incluye una orden de práctica y cierra presentando la
// Asistencia 24 h. Se puede omitir en cualquier paso y repetir desde «Más».

const STORAGE_PREFIX = 'riffast:admin-tour:v1:';
const START_DELAY_MS = 900; // después de la intro, para no encimar la bienvenida
const TARGET_TIMEOUT_MS = 3500; // si el elemento no aparece, la tarjeta se centra
const PAD = 6; // aire alrededor del elemento iluminado
const GAP = 14; // separación entre el elemento y la tarjeta
const EDGE = 16; // margen mínimo con los bordes de la pantalla

function tourSeen(userId: string): boolean {
  try {
    return !!localStorage.getItem(STORAGE_PREFIX + userId);
  } catch {
    return false;
  }
}

function markTour(userId: string, result: 'completado' | 'omitido'): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, `${result}:${new Date().toISOString()}`);
  } catch {
    /* almacenamiento no disponible: el tutorial podría volver a salir */
  }
}

// ── Contexto: para repetir el tutorial desde «Más» o el menú lateral ──
interface TourApi {
  startTour: () => void;
  active: boolean;
}
const TourContext = createContext<TourApi | null>(null);

export function useAdminTour(): TourApi {
  return useContext(TourContext) ?? { startTour: () => {}, active: false };
}

function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return match;
}

export function AdminTourProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const userId = user?.id ?? null;

  const startTour = useCallback(() => {
    setRunId((n) => n + 1);
    setOpen(true);
  }, []);

  // Primera vez de este usuario en este dispositivo: arranca al terminar la intro.
  useEffect(() => {
    if (!userId || tourSeen(userId)) return;
    let cancelled = false;
    let timer: number | undefined;
    afterIntro(() => {
      timer = window.setTimeout(() => {
        if (!cancelled && !tourSeen(userId)) startTour();
      }, START_DELAY_MS);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId, startTour]);

  const value = useMemo(() => ({ startTour, active: open }), [startTour, open]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {open && userId && (
        <TourOverlay
          key={runId}
          steps={user?.role === 'SELLER' ? SELLER_STEPS : ADMIN_STEPS}
          onClose={(result) => {
            markTour(userId, result);
            setOpen(false);
          }}
        />
      )}
    </TourContext.Provider>
  );
}

// ── Medición del elemento iluminado ──────────────────────────────────
interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

function findTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0.05) return el;
  }
  return null;
}

function spotOf(el: HTMLElement): Spot {
  const r = el.getBoundingClientRect();
  const raw = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
  const width = r.width + PAD * 2;
  const height = r.height + PAD * 2;
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width,
    height,
    radius: Math.min(raw + PAD, height / 2, width / 2),
  };
}

const sameSpot = (a: Spot | null, b: Spot | null) =>
  !!a &&
  !!b &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

// Sigue al elemento del paso (puede tardar en aparecer tras navegar y moverse
// con animaciones o al girar el teléfono). null = paso centrado.
function useSpot(targetId: string | undefined, stepKey: string): { spot: Spot | null; missing: boolean } {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setSpot(null);
    setMissing(false);
    if (!targetId) return;
    const started = performance.now();
    let raf = 0;
    let scrolled = false;
    let last: Spot | null = null;
    const tick = () => {
      const el = findTarget(targetId);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const next = spotOf(el);
        if (!sameSpot(last, next)) {
          last = next;
          setSpot(next);
        }
      } else if (performance.now() - started > TARGET_TIMEOUT_MS && !last) {
        setMissing(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetId, stepKey]);

  return { spot, missing };
}

// Dónde va la tarjeta: a la derecha del menú lateral en computadora; arriba o
// abajo del elemento en celular (donde haya más espacio).
function placeCard(spot: Spot, card: { w: number; h: number }, vw: number, vh: number) {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  const cx = spot.left + spot.width / 2;
  if (vw >= 1024 && spot.left + spot.width < vw * 0.35) {
    const top = clamp(spot.top + spot.height / 2 - card.h / 2, EDGE, vh - card.h - EDGE);
    return { top, left: spot.left + spot.width + GAP, side: 'right' as const, arrow: spot.top + spot.height / 2 - top };
  }
  const below = vh - (spot.top + spot.height) - GAP - EDGE;
  const above = spot.top - GAP - EDGE;
  const left = clamp(cx - card.w / 2, EDGE, vw - card.w - EDGE);
  const arrow = clamp(cx - left, 24, card.w - 24);
  if (below >= card.h || below >= above) {
    return { top: Math.min(spot.top + spot.height + GAP, vh - card.h - EDGE), left, side: 'bottom' as const, arrow };
  }
  return { top: Math.max(EDGE, spot.top - GAP - card.h), left, side: 'top' as const, arrow };
}

// ── Overlay ─────────────────────────────────────────────────────────
function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: (result: 'completado' | 'omitido') => void }) {
  const container = usePortalContainer();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { openAssistant } = useAssistant();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<PracticePhase>('apartada');
  const step = steps[index];
  const total = steps.length;
  const numbered = steps.filter((s) => s.kind !== 'welcome');
  const position = numbered.indexOf(step) + 1;

  // Cada paso abre la pantalla donde vive lo que se ilumina.
  const route = isDesktop ? step.route?.desktop : step.route?.mobile;
  useEffect(() => {
    if (route && location.pathname !== route) navigate(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const { spot, missing } = useSpot(step.kind === 'spotlight' || step.kind === 'final' ? step.target : undefined, step.id);
  const centered = step.kind === 'welcome' || step.kind === 'practice' || !spot;
  const waiting = !centered ? false : (step.kind === 'spotlight' || step.kind === 'final') && !spot && !missing;

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= total) {
      finish(false);
      return;
    }
    setIndex(next);
  };

  const seller = steps === SELLER_STEPS;
  const skip = () => {
    onClose('omitido');
    toast('Puedes ver el tutorial cuando quieras', {
      description: isDesktop
        ? 'En el menú lateral, «Ver tutorial».'
        : seller
          ? 'En Mi panel → Ayuda → Ver tutorial.'
          : 'En Más → Ayuda → Tutorial del administrador.',
    });
  };

  const finish = (withAssistant: boolean) => {
    onClose('completado');
    if (withAssistant) openAssistant();
    else navigate('/admin/inicio');
  };

  // Teclado: ← → para moverse, Escape para omitir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      } else if (e.key === 'ArrowRight' && step.kind !== 'practice') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Posición de la tarjeta (se mide antes de pintarla).
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, centered]);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // El foco va al botón principal en cada paso (teclado y lector de pantalla).
  useEffect(() => {
    const t = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, [index]);

  const placement = !centered && spot && size ? placeCard(spot, size, viewport.w, viewport.h) : null;
  const cardStyle: React.CSSProperties = placement
    ? { top: placement.top, left: placement.left }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const isLast = index === total - 1;
  const practicePending = step.kind === 'practice' && phase !== 'pagada';

  const overlay = (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* Capa que bloquea el panel mientras dura el recorrido. */}
      <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />

      {/* Fondo atenuado con «hueco» sobre el elemento del paso. */}
      {spot && !centered ? (
        <div
          aria-hidden
          className="pointer-events-none absolute transition-[top,left,width,height,border-radius] duration-300 ease-ios motion-reduce:transition-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: spot.radius,
            boxShadow:
              '0 0 0 9999px rgba(8, 12, 10, 0.62), 0 0 0 2px rgb(var(--rf-accent) / 0.9), 0 0 22px 6px rgb(var(--rf-accent) / 0.28)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgba(8,12,10,0.62)] animate-rf-fade-in" />
      )}

      {/* Tarjeta */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={{ ...cardStyle, visibility: waiting || (!centered && !placement) ? 'hidden' : 'visible' }}
        className={cn(
          'absolute rounded-sheet bg-rf-surface text-rf-label shadow-float outline-none',
          step.kind === 'practice' ? 'w-[min(400px,calc(100vw-32px))]' : 'w-[min(360px,calc(100vw-32px))]',
          !centered && 'transition-[top,left] duration-300 ease-ios motion-reduce:transition-none',
        )}
      >
        {/* Flecha hacia el elemento */}
        {placement && (
          <span
            aria-hidden
            className="absolute h-3.5 w-3.5 rotate-45 bg-rf-surface"
            style={
              placement.side === 'right'
                ? { left: -7, top: Math.min(Math.max(placement.arrow - 7, 18), (size?.h ?? 0) - 25) }
                : placement.side === 'bottom'
                  ? { top: -7, left: placement.arrow - 7 }
                  : { bottom: -7, left: placement.arrow - 7 }
            }
          />
        )}

        {/* Contenido recortado a las esquinas; la flecha queda por fuera. */}
        <div className="relative flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden rounded-sheet">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {step.kind === 'welcome' ? (
            <Welcome seller={seller} />
          ) : (
            <div className="px-5 pb-2 pt-5">
              {/* Progreso */}
              <div className="mb-3 flex items-center gap-1" aria-hidden>
                {numbered.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      i < position ? 'bg-rf-accent' : 'bg-rf-fill-strong',
                    )}
                  />
                ))}
              </div>
              <p className="text-caption font-semibold uppercase tracking-[0.04em] text-rf-accent">
                {step.kind === 'practice' ? 'Práctica' : 'Paso'} {position} de {numbered.length}
              </p>
              <h2 id="tour-title" className="mt-1 text-[20px] font-bold leading-[26px] tracking-[-0.012em]">
                {step.kind === 'final' && <Headset className="mr-1.5 inline h-5 w-5 -translate-y-0.5 text-rf-accent" />}
                {step.title}
              </h2>
              <div id="tour-body" className="mt-2 text-callout text-rf-secondary">
                {step.kind === 'practice' ? <PracticeIntro phase={phase} /> : step.body}
              </div>
              {step.kind === 'practice' && (
                <div className="mt-4">
                  <PracticeOrder phase={phase} onPhase={setPhase} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie: omitir · atrás · siguiente */}
        <div className="flex shrink-0 items-center gap-2 border-t border-rf-separator px-3 py-3">
          {step.kind === 'welcome' ? (
            <>
              <Button variant="ghost" className="flex-1" onClick={skip}>
                Omitir por ahora
              </Button>
              <Button ref={primaryRef} className="flex-[1.4]" onClick={() => go(1)}>
                Empezar
              </Button>
            </>
          ) : (
            <>
              {!isLast && (
                <button
                  type="button"
                  onClick={skip}
                  className="h-11 shrink-0 rounded-full px-3 text-callout font-medium text-rf-secondary outline-none active:opacity-60 focus-visible:ring-2 focus-visible:ring-rf-accent/45"
                >
                  Omitir
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                aria-label="Paso anterior"
                onClick={() => go(-1)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rf-fill text-rf-label outline-none active:opacity-60 focus-visible:ring-2 focus-visible:ring-rf-accent/45"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
              </button>
              {isLast ? (
                <>
                  <Button variant="secondary" onClick={() => finish(false)}>
                    Terminar
                  </Button>
                  <Button ref={primaryRef} onClick={() => finish(true)}>
                    Abrir asistente
                  </Button>
                </>
              ) : (
                <Button ref={primaryRef} variant={practicePending ? 'secondary' : 'default'} onClick={() => go(1)}>
                  {practicePending ? 'Saltar práctica' : 'Siguiente'}
                </Button>
              )}
            </>
          )}
        </div>
        </div>
      </div>

      {/* Anuncio para lectores de pantalla en cada cambio de paso. */}
      <p className="sr-only" aria-live="polite">
        {step.kind === 'welcome' ? step.title : `Paso ${position} de ${numbered.length}: ${step.title}`}
      </p>
    </div>
  );

  return createPortal(overlay, container ?? document.body);
}

function PracticeIntro({ phase }: { phase: PracticePhase }) {
  if (phase === 'apartada') {
    return (
      <>
        Esta orden es de ejemplo. Cuando tu comprador te pague, toca{' '}
        <strong className="font-semibold text-rf-label">Marcar pagado</strong>.
      </>
    );
  }
  if (phase === 'confirmar') {
    return (
      <>
        Elige cómo te pagó y toca <strong className="font-semibold text-rf-label">Sí, confirmar pago</strong>. Así queda
        registro de cada cobro.
      </>
    );
  }
  return (
    <>
      ¡Así de fácil! La orden pasó a <strong className="font-semibold text-rf-label">Pagada</strong>. Es una práctica: no
      se guardó nada ni se avisó a nadie.
    </>
  );
}

const WELCOME_ITEMS: { icon: LucideIcon; text: string }[] = [
  { icon: Ticket, text: 'Crear y publicar una rifa' },
  { icon: Receipt, text: 'Confirmar un pago y enviar el boleto' },
  { icon: CreditCard, text: 'Recibir pagos directo en tu cuenta' },
  { icon: Users, text: 'Sumar a tu equipo de vendedores' },
];

const SELLER_WELCOME_ITEMS: { icon: LucideIcon; text: string }[] = [
  { icon: Ticket, text: 'Compartir tu link de venta' },
  { icon: Receipt, text: 'Confirmar el pago de tus ventas' },
  { icon: Headset, text: 'Pedir ayuda a cualquier hora' },
];

function Welcome({ seller }: { seller: boolean }) {
  const items = seller ? SELLER_WELCOME_ITEMS : WELCOME_ITEMS;
  return (
    <div className="px-6 pb-4 pt-7 text-center">
      <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[18px] bg-rf-surface shadow-card ring-1 ring-rf-separator">
        <LogoMark className="h-10 w-10" />
      </span>
      <p className="text-caption font-semibold uppercase tracking-[0.06em] text-rf-accent">Bienvenido a {webEnv.brandName}</p>
      <h2 id="tour-title" className="mt-1.5 text-[24px] font-bold leading-[30px] tracking-[-0.018em]">
        {seller ? 'Tu panel de vendedor en 1 minuto' : 'Tu administrador en 1 minuto'}
      </h2>
      <p id="tour-body" className="mx-auto mt-2 max-w-[290px] text-callout text-rf-secondary">
        Te mostramos dónde está cada cosa para que empieces a vender hoy mismo.
      </p>
      <ul className="mt-5 space-y-2.5 text-left">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-control bg-rf-fill/70 px-3 py-2.5">
            <span className="rf-gem rf-gem-tile grid h-8 w-8 shrink-0 place-items-center rounded-[9px]">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="text-callout font-medium text-rf-label">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-rf-tertiary">
        Puedes omitirlo y verlo después desde {seller ? '«Mi panel»' : '«Más»'}.
      </p>
    </div>
  );
}

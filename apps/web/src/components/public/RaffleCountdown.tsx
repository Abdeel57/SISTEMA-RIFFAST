import { Fragment, useEffect, useState } from 'react';
import { formatDateTime, RaffleStatus } from '@riffast/shared';
import { useT, useLocale } from '@/store/site';

// Cuenta regresiva al sorteo. Si la rifa sigue activa y la fecha es futura,
// muestra un cronómetro (días/horas/min/seg) que corre en vivo. Si ya finalizó
// o no hay cuenta regresiva, sólo muestra la fecha del sorteo.
// Sin fondo propio (transparente): vive dentro del hero y hereda su fondo,
// para que la sombra del marco de la imagen fluya hacia abajo sin cortarse.

function breakdown(target: Date, now: number) {
  const ms = Math.max(0, target.getTime() - now);
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1_000),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// Una unidad del contador: placa de metal pulido con los dígitos grabados.
// `index` escalona el destello para que recorra las placas en ola.
function Plate({ value, index }: { value: number; index: number }) {
  return (
    <div
      className="metal-tile grid min-w-[64px] place-items-center px-3 py-3.5 sm:min-w-[88px] sm:px-4 sm:py-4"
      style={{ '--sheen-delay': `${index * 0.14}s` } as React.CSSProperties}
    >
      <span className="metal-digits font-sans text-[2.15rem] font-extrabold leading-none tracking-tight sm:text-[2.9rem]">
        {pad(value)}
      </span>
    </div>
  );
}

// Separador: dos remaches cromados (en lugar de ":").
function Rivets() {
  return (
    <span className="flex flex-col justify-center gap-2 self-stretch sm:gap-2.5" aria-hidden>
      <span className="metal-rivet" />
      <span className="metal-rivet" />
    </span>
  );
}

interface Props {
  drawDate: string | null;
  status: RaffleStatus;
}

export function RaffleCountdown({ drawDate, status }: Props) {
  const tr = useT();
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const target = drawDate ? new Date(drawDate) : null;
  const finished = status === RaffleStatus.FINISHED || status === RaffleStatus.CANCELLED;
  const live = !!target && !finished && target.getTime() > now;

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  // Sin fecha y sin finalizar: nada que mostrar.
  if (!target && !finished) return null;

  if (live && target) {
    const { d, h, m, s } = breakdown(target, now);
    // Solo números: con días → DD HH MM SS; el último día → HH MM SS.
    const values = d > 0 ? [d, h, m, s] : [h, m, s];
    // Sin etiquetas visibles: el lector de pantalla recibe el tiempo completo.
    const spoken = `${tr('countdown.remaining')}: ${d} ${tr(d === 1 ? 'countdown.day' : 'countdown.days')}, ${h} ${tr('countdown.hours')}, ${m} ${tr('countdown.minutes')}, ${s} ${tr('countdown.seconds')}`;
    return (
      <section className="px-4 pb-5 pt-4 text-foreground">
        <div className="mx-auto max-w-2xl text-center" role="timer" aria-label={spoken}>
          <p
            aria-hidden
            className="metal-caption mb-3.5 flex items-center justify-center gap-3 text-[11px] font-light uppercase tracking-[0.42em] text-muted-foreground sm:text-xs"
          >
            {tr('countdown.remaining')}
          </p>

          <div aria-hidden className="flex items-stretch justify-center gap-2 sm:gap-3">
            {values.map((value, i) => (
              <Fragment key={values.length - i}>
                {i > 0 && <Rivets />}
                <Plate value={value} index={i} />
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Finalizado, cancelado o fecha ya pasada: sólo la fecha del sorteo.
  return (
    <section className="bg-background px-4 pb-6 pt-2 text-foreground">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {tr(finished ? 'countdown.drawDone' : 'countdown.drawDate')}
        </p>
        {drawDate && (
          <p className="mt-2 text-lg font-black uppercase tracking-wide text-foreground sm:text-xl">
            {formatDateTime(drawDate, locale)}
          </p>
        )}
      </div>
    </section>
  );
}

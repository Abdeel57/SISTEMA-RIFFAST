import { AlertTriangle, CheckCircle2, Clock, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ActionView, CallView, ChatLink } from '@/services/assistant';
import { ChatMarkdown } from './ChatMarkdown';

// Tarjeta de confirmación: nada se cambia hasta que el rifero toca «Confirmar».

interface ActionCardProps {
  action: ActionView;
  busy: 'confirm' | 'cancel' | null;
  onConfirm: (action: ActionView) => void;
  onCancel: (action: ActionView) => void;
  onInternalLink: (path: string) => void;
}

function LinkButton({ link, onInternalLink }: { link: ChatLink; onInternalLink: (path: string) => void }) {
  if (link.url.startsWith('/admin')) {
    return (
      <Button variant="secondary" size="sm" className="w-full" onClick={() => onInternalLink(link.url)}>
        {link.texto}
      </Button>
    );
  }
  return (
    <Button asChild variant="secondary" size="sm" className="w-full">
      <a href={link.url} target="_blank" rel="noopener noreferrer">
        {link.texto}
      </a>
    </Button>
  );
}

export function ActionCard({ action, busy, onConfirm, onCancel, onInternalLink }: ActionCardProps) {
  const { tarjeta: card, estado, resultado } = action;
  const pending = estado === 'pendiente';
  const working = estado === 'ejecutando' || busy === 'confirm';
  const hasDigits = card.campos.some((f) => f.destacado && /\d{4} \d{4}/.test(f.valor));

  return (
    <section
      aria-label={card.titulo}
      className={cn(
        'w-full max-w-[92%] overflow-hidden rounded-2xl border bg-rf-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        card.riesgo && pending ? 'border-rf-danger/30' : 'border-rf-separator',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-rf-separator px-4 py-3">
        <h4 className="text-callout font-semibold text-rf-label">{card.titulo}</h4>
        {estado === 'hecha' && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-rf-accent">
            <CheckCircle2 className="h-4 w-4" /> Hecho
          </span>
        )}
        {estado === 'cancelada' && <span className="text-caption font-semibold text-rf-secondary">Cancelada</span>}
        {estado === 'expirada' && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-rf-secondary">
            <Clock className="h-4 w-4" /> Expiró
          </span>
        )}
        {estado === 'fallida' && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-rf-danger">
            <XCircle className="h-4 w-4" /> No se pudo
          </span>
        )}
      </header>

      <dl className={cn('space-y-2.5 px-4 py-3', !pending && estado !== 'ejecutando' && 'opacity-80')}>
        {card.campos.map((f, i) => (
          <div key={i}>
            <dt className="text-caption text-rf-secondary">{f.etiqueta}</dt>
            <dd
              className={cn(
                'break-words text-callout text-rf-label',
                f.destacado && 'mt-0.5 text-[20px] font-semibold leading-7 tabular-nums',
                // Tarjeta y CLABE: monoespaciados para revisar dígito por dígito.
                f.destacado && /^[\d ]+$/.test(f.valor) && 'font-mono tracking-wide',
              )}
            >
              {f.valor}
            </dd>
          </div>
        ))}
      </dl>

      {pending && card.avisos.length > 0 && (
        <ul className="mx-4 mb-3 space-y-1.5 rounded-control bg-rf-warning/10 px-3 py-2.5">
          {card.avisos.map((a, i) => (
            <li key={i} className="flex gap-2 text-caption text-rf-label">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rf-warning" />
              <span className={cn(hasDigits && /dígito/.test(a) && 'font-semibold')}>{a}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="px-4 pb-4">
        {(pending || estado === 'ejecutando') && (
          <div className="flex flex-col gap-2">
            <Button
              variant={card.riesgo ? 'destructive' : 'default'}
              className="w-full"
              loading={working}
              loadingText="Guardando…"
              disabled={busy !== null || estado === 'ejecutando'}
              onClick={() => onConfirm(action)}
            >
              {card.boton || 'Confirmar'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={busy !== null || estado === 'ejecutando'}
              onClick={() => onCancel(action)}
            >
              Cancelar
            </Button>
          </div>
        )}

        {estado === 'hecha' && resultado && (
          <div className="space-y-2">
            <div className="text-callout text-rf-label">
              <ChatMarkdown text={resultado.mensaje} onInternalLink={onInternalLink} />
            </div>
            {resultado.whatsapp && (
              <Button asChild variant="secondary" size="sm" className="w-full">
                <a href={resultado.whatsapp.url} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-[18px] w-[18px]" /> {resultado.whatsapp.texto}
                </a>
              </Button>
            )}
            {resultado.enlace && <LinkButton link={resultado.enlace} onInternalLink={onInternalLink} />}
          </div>
        )}
        {estado === 'cancelada' && <p className="text-callout text-rf-secondary">No se cambió nada.</p>}
        {estado === 'expirada' && <p className="text-callout text-rf-secondary">Expiró, pídemelo de nuevo.</p>}
        {estado === 'fallida' && (
          <p className="text-callout text-rf-danger">{resultado?.mensaje ?? 'No se pudo completar. Intenta de nuevo.'}</p>
        )}
      </footer>
    </section>
  );
}

export function CallCard({ call }: { call: CallView }) {
  return (
    <section className="w-full max-w-[92%] rounded-2xl border border-rf-accent/25 bg-rf-accent/[0.06] px-4 py-3">
      <p className="text-callout font-semibold text-rf-label">
        📞 Te llamaremos al <span className="tabular-nums">{call.telefono}</span> lo antes posible
      </p>
      <p className="mt-1 text-caption text-rf-secondary">Horario de llamadas: {call.horario}. Puedes seguir escribiendo aquí.</p>
    </section>
  );
}

export function TypingBubble() {
  return (
    <div className="flex items-center gap-2 self-start rounded-[20px] rounded-bl-md bg-rf-fill px-4 py-2.5 text-callout text-rf-secondary">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Escribiendo…
    </div>
  );
}

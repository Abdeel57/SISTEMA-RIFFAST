import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// Kit visual del panel del rifero (estética Apple): tarjetas blancas sobre el
// fondo gris, sin bordes y con sombra mínima; el verde de la marca es el único
// acento. Todo sale de los tokens `rf-*` (tailwind.config.ts / index.css).

// Tarjeta base del panel.
export const PANEL_CARD = 'rounded-card bg-rf-surface shadow-card';

// Encabezado de sección del panel: ícono opcional, título, descripción y acción.
export function PanelHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-control bg-rf-accent/10 text-rf-accent">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-heading text-rf-label">{title}</h1>
          {description && <p className="mt-0.5 text-callout text-rf-secondary">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Intro de sección SIN título: el título grande del panel ya nombra la
// pantalla. Solo una línea de contexto (opcional) y/o una acción en línea.
export function PanelIntro({
  description,
  action,
  className,
}: {
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  if (!description && !action) return null;
  return (
    <div className={cn('mb-5 flex items-center justify-between gap-3', className)}>
      {description ? <p className="min-w-0 text-callout text-rf-secondary">{description}</p> : <span />}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Encabezado de grupo (encima de listas o grupos de tarjetas), como en Ajustes.
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('mb-2 mt-8 px-4 text-caption font-medium uppercase tracking-[0.02em] text-rf-secondary', className)}>
      {children}
    </h2>
  );
}

// Tarjeta de métrica: número grande en negrita (lo primero que se busca) y
// etiqueta debajo. `accent` resalta la métrica más importante.
export function StatTile({
  icon: Icon,
  label,
  value,
  to,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  to?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className={cn(PANEL_CARD, 'flex h-full flex-col gap-3 p-4', to && 'rf-press')}>
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-[9px]',
          accent ? 'bg-rf-accent text-white' : 'bg-rf-accent/10 text-rf-accent',
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-heading tabular-nums text-rf-label">{value}</p>
        <p className="mt-0.5 truncate text-callout text-rf-secondary">{label}</p>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-card">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// Tarjeta de sección con cabecera (para formularios y bloques de contenido).
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(PANEL_CARD, 'overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-rf-separator px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-rf-accent/10 text-rf-accent">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-body font-semibold text-rf-label">{title}</h3>}
              {description && <p className="truncate text-callout text-rf-secondary">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </div>
  );
}

// Barra de progreso de venta: delgada y sólida, en el verde de la marca.
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-rf-fill-strong"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-rf-accent transition-[width] duration-slow ease-ios" style={{ width: `${pct}%` }} />
    </div>
  );
}

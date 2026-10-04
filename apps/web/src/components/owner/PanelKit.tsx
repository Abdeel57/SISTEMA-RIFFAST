import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconTile } from '@/components/owner/List';

// Botón de solo ícono (44×44): «⋯» de las tarjetas, acciones del encabezado.
// `label` es obligatorio: es lo que lee el lector de pantalla.
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: 'neutral' | 'accent' }
>(({ icon: Icon, label, tone = 'neutral', className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    className={cn(
      'rf-press grid h-11 w-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 disabled:opacity-40',
      tone === 'accent' ? 'text-rf-accent active:bg-rf-accent/10' : 'bg-rf-fill text-rf-label active:bg-rf-fill-strong',
      className,
    )}
    {...props}
  >
    <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
  </button>
));
IconButton.displayName = 'IconButton';

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
        {Icon && <IconTile icon={Icon} tone="soft" size={40} className="mt-0.5" />}
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
      <IconTile icon={Icon} tone={accent ? 'accent' : 'soft'} size={32} />
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
            {Icon && <IconTile icon={Icon} tone="soft" size={32} />}
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

// Barra fija al pie de un formulario (Guardar cambios, Siguiente…): siempre a
// la mano en celular, sobre el indicador de inicio del iPhone. `dirty` avisa
// de cambios sin guardar.
export function StickyBar({
  children,
  dirty,
  className,
}: {
  children: React.ReactNode;
  dirty?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-gutter -mb-[max(1.25rem,env(safe-area-inset-bottom))] mt-6 border-t border-rf-separator bg-rf-bg px-gutter pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:-mx-8 lg:-mb-16 lg:px-8 lg:pb-5',
        className,
      )}
    >
      {dirty && (
        <p role="status" className="mb-2 text-center text-caption font-medium text-rf-warning">
          Tienes cambios sin guardar
        </p>
      )}
      {children}
    </div>
  );
}

// Opciones rápidas en píldoras (p. ej. 1 hora · 6 horas · 24 horas).
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; value: T }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rf-press h-11 rounded-full px-4 text-callout font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45',
              active ? 'rf-gem rf-gem-flat' : 'bg-rf-fill text-rf-label active:bg-rf-fill-strong',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Barra de progreso de venta: delgada, con el acabado gema del verde de la marca.
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
      <div className="rf-gem rf-gem-flat h-full rounded-full transition-[width] duration-slow ease-ios" style={{ width: `${pct}%` }} />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Switch } from '@/components/ui/switch';

// Listas agrupadas como en Ajustes de iOS: un grupo = tarjeta blanca con filas
// separadas por una línea fina que arranca donde empieza el texto.

export type IconTone = 'accent' | 'neutral' | 'danger' | 'info' | 'soft';

const TILE_TONE: Record<IconTone, string> = {
  accent: 'rf-gem rf-gem-tile',
  neutral: 'rf-gem rf-gem-graphite',
  danger: 'rf-gem rf-gem-danger',
  info: 'rf-gem rf-gem-info',
  soft: 'rf-gem-soft',
};

// Cuadro de ícono del panel, con el acabado «gema» (ver .rf-gem en index.css).
// Radio continuo proporcional como en iOS (~23 % del lado); `round` lo hace
// círculo. El glifo va a ~60 % en cuadros chicos y a la mitad en los grandes.
export function IconTile({
  icon: Icon,
  tone = 'accent',
  size = 30,
  round = false,
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: number;
  round?: boolean;
  className?: string;
}) {
  const glyph = size <= 32 ? 18 : Math.round(size / 2);
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', TILE_TONE[tone], className)}
      style={{ width: size, height: size, borderRadius: round ? 9999 : Math.round(size * 0.235) }}
    >
      <Icon style={{ width: glyph, height: glyph }} strokeWidth={2} />
    </span>
  );
}

export function ListGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-6', className)}>
      {header && (
        <h2 className="mb-2 px-4 text-caption font-medium uppercase tracking-[0.02em] text-rf-secondary">{header}</h2>
      )}
      <div className="overflow-hidden rounded-card bg-rf-surface shadow-card [&>*+*]:border-t [&>*+*]:border-rf-separator">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-caption text-rf-secondary">{footer}</p>}
    </section>
  );
}

// Una fila navega (`to`), abre un enlace (`href`) o ejecuta algo (`onClick`);
// sin ninguno es solo informativa. Si se pasan varios, gana ese orden.
interface RowAction {
  to?: string;
  href?: string;
  onClick?: () => void;
}

export type ListRowProps = RowAction & {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Elemento propio a la izquierda (en lugar de `icon`). */
  leading?: React.ReactNode;
  /** Tono del cuadro del ícono: verde de marca (default), grafito, rojo, azul o suave. */
  iconTone?: IconTone;
  /** Valor a la derecha (p. ej. «2 horas», un número). */
  value?: React.ReactNode;
  /** Control a la derecha (interruptor, botón). Desactiva el chevron. */
  trailing?: React.ReactNode;
  destructive?: boolean;
  /** Texto centrado (filas de acción como «Cerrar sesión»). */
  center?: boolean;
  chevron?: boolean;
  external?: boolean;
  disabled?: boolean;
  className?: string;
  /** Marca para el tutorial del administrador (data-tour). */
  tourId?: string;
};

export function ListRow(props: ListRowProps) {
  const {
    title,
    subtitle,
    icon: Icon,
    leading,
    iconTone = 'accent',
    value,
    trailing,
    destructive,
    center,
    disabled,
    external,
    className,
  } = props;
  const interactive = Boolean(props.to || props.onClick || props.href);
  const showChevron = props.chevron ?? (interactive && !trailing && !center && !destructive);

  const body = (
    <>
      {leading}
      {!leading && Icon && <IconTile icon={Icon} tone={iconTone} />}
      <span className={cn('min-w-0 flex-1 py-3', center && 'text-center')}>
        <span className={cn('block text-body', destructive ? 'text-rf-danger' : 'text-rf-label', center && 'font-medium')}>
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block text-callout text-rf-secondary">{subtitle}</span>}
      </span>
      {value !== undefined && value !== null && (
        <span className="shrink-0 text-body text-rf-secondary tabular-nums">{value}</span>
      )}
      {trailing && <span className="shrink-0">{trailing}</span>}
      {showChevron && <ChevronRight className="h-5 w-5 shrink-0 text-rf-tertiary" strokeWidth={2.2} />}
    </>
  );

  const rowClass = cn(
    'flex min-h-[52px] w-full items-center gap-3.5 px-4 text-left outline-none focus-visible:bg-rf-fill',
    interactive && !disabled && 'rf-row',
    disabled && 'opacity-40',
    className,
  );

  if (props.to && !disabled) {
    return (
      <Link to={props.to} className={rowClass} data-tour={props.tourId}>
        {body}
      </Link>
    );
  }
  if (props.href && !disabled) {
    return (
      <a
        href={props.href}
        data-tour={props.tourId}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className={rowClass}
      >
        {body}
      </a>
    );
  }
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} disabled={disabled} className={rowClass} data-tour={props.tourId}>
        {body}
      </button>
    );
  }
  return (
    <div className={rowClass} data-tour={props.tourId}>
      {body}
    </div>
  );
}

// Fila con interruptor (como Ajustes): título, explicación y el switch a la
// derecha. Toda la fila es su etiqueta, así que tocar el texto también cambia.
export function ToggleRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  note,
  icon,
  switchLabel,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  /** Aviso bajo la descripción (p. ej. «Tu plan no incluye esta función»). */
  note?: React.ReactNode;
  icon?: LucideIcon;
  switchLabel?: string;
}) {
  const Icon = icon;
  return (
    <div className={cn('flex min-h-[52px] items-center gap-3.5 px-4 py-3', disabled && 'opacity-60')}>
      {Icon && <IconTile icon={Icon} className="self-start" />}
      <label htmlFor={id} className={cn('min-w-0 flex-1', !disabled && 'cursor-pointer')}>
        <span className="block text-body text-rf-label">{title}</span>
        {description && <span className="mt-0.5 block text-callout text-rf-secondary">{description}</span>}
        {note && <span className="mt-1 block text-caption font-medium text-rf-warning">{note}</span>}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={switchLabel}
      />
    </div>
  );
}

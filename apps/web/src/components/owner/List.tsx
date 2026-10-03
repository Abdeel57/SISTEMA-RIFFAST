import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// Listas agrupadas como en Ajustes de iOS: un grupo = tarjeta blanca con filas
// separadas por una línea fina que arranca donde empieza el texto.

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
    <section className={cn('mt-6 first:mt-0', className)}>
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

type RowAction =
  | { to: string; onClick?: never; href?: never }
  | { onClick: () => void; to?: never; href?: never }
  | { href: string; onClick?: never; to?: never }
  | { to?: undefined; onClick?: undefined; href?: undefined };

export type ListRowProps = RowAction & {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Color del cuadro del ícono: verde de marca (default), gris o rojo. */
  iconTone?: 'accent' | 'neutral' | 'danger';
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
};

export function ListRow(props: ListRowProps) {
  const {
    title,
    subtitle,
    icon: Icon,
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
      {Icon && (
        <span
          className={cn(
            'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]',
            iconTone === 'accent' && 'bg-rf-accent text-white',
            iconTone === 'neutral' && 'bg-rf-fill-strong text-rf-label',
            iconTone === 'danger' && 'bg-rf-danger text-white',
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </span>
      )}
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
      <Link to={props.to} className={rowClass}>
        {body}
      </Link>
    );
  }
  if (props.href && !disabled) {
    return (
      <a
        href={props.href}
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
      <button type="button" onClick={props.onClick} disabled={disabled} className={rowClass}>
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

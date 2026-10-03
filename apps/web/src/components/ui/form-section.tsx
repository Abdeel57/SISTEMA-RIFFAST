import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

// Sección de formulario con el estilo de la página de rifas: tarjeta con título
// claro, descripción opcional y campos bien espaciados. Sin iconos.
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-card p-5 shadow-sm ${className ?? ''}`}>
      <h2 className="font-display text-base font-extrabold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

// Campo: etiqueta + control + pista o error. Unifica el espaciado y la lectura.
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

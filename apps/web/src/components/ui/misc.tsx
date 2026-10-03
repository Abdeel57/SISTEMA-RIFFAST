import * as React from 'react';
import { CircleAlert, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const admin = useAdminSurface();
  return <div className={cn(admin ? 'rf-skeleton rounded-control' : 'animate-pulse rounded-xl bg-muted', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  const admin = useAdminSurface();
  return <Loader2 className={cn('h-6 w-6 animate-spin', admin ? 'text-rf-secondary' : 'text-primary', className)} />;
}

export function Separator({ className }: { className?: string }) {
  const admin = useAdminSurface();
  return <div className={cn('h-px w-full', admin ? 'bg-rf-separator' : 'bg-border', className)} />;
}

// Carga de una pantalla. En el administrador es un esqueleto (la forma del
// contenido que viene), no un spinner: se siente más rápido y no salta.
export function PageLoader({ label = 'Cargando...' }: { label?: string }) {
  const admin = useAdminSurface();
  if (admin) {
    return (
      <div role="status" aria-live="polite" className="space-y-3 py-1">
        <span className="sr-only">{label}</span>
        <div className="rounded-card bg-rf-surface p-4 shadow-card">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-8 w-1/2" />
          <Skeleton className="mt-4 h-4 w-full" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-card bg-rf-surface p-4 shadow-card">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const admin = useAdminSurface();
  if (admin) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        {icon && (
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-rf-fill-strong text-rf-secondary [&_svg]:h-7 [&_svg]:w-7">
            {icon}
          </div>
        )}
        <h3 className="text-body font-semibold text-rf-label">{title}</h3>
        {description && <p className="mt-1 max-w-xs text-callout text-rf-secondary">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-14 px-6 text-center">
      {icon && <div className="text-muted-foreground/70">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Estado de error de una pantalla: qué pasó en palabras simples y «Reintentar».
export function ErrorState({
  title = 'No pudimos cargar esta información',
  description = 'Revisa tu conexión a internet e inténtalo de nuevo.',
  onRetry,
  retrying = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <EmptyState
      icon={<CircleAlert />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" loading={retrying} loadingText="Reintentando…" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        ) : undefined
      }
    />
  );
}

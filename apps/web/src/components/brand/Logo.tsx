import { cn } from '@/lib/cn';
import { LogoMark } from './LogoMark';
import logoDarkUrl from '@/assets/riffast-logo-dark.svg';
import logoLightUrl from '@/assets/riffast-logo-light.svg';

// Logotipo horizontal de Riffast (trébol + nombre en curvas). El alto lo da
// `className` (h-8 por defecto); el ancho se ajusta solo a la proporción.
//   tone="dark"  → nombre en verde tinta (superficies claras).
//   tone="light" → nombre en blanco (superficies oscuras).
//   tone="auto"  → tinta en tema claro, blanco en tema oscuro.
// withText=false deja solo el trébol.
export function Logo({
  className,
  withText = true,
  tone = 'auto',
}: {
  className?: string;
  withText?: boolean;
  tone?: 'dark' | 'light' | 'auto';
}) {
  if (!withText) return <LogoMark className={cn('h-8 w-8', className)} />;

  const img = (src: string, extra?: string) => (
    <img src={src} alt="Riffast" draggable={false} className={cn('block h-full w-auto select-none', extra)} />
  );

  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center', className)}>
      {tone === 'dark' && img(logoDarkUrl)}
      {tone === 'light' && img(logoLightUrl)}
      {tone === 'auto' && (
        <>
          {img(logoDarkUrl, 'dark:hidden')}
          {img(logoLightUrl, 'hidden dark:block')}
        </>
      )}
    </span>
  );
}

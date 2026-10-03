import { BRAND, buildWhatsappLink } from '@riffast/shared';
import { webEnv } from '@/lib/env';
import { LogoMark } from './LogoMark';
import { cn } from '@/lib/cn';

// Marca discreta para páginas públicas: "Desarrollado por Riffast".
// Si hay WhatsApp de Riffast configurado, enlaza al chat; si no, es solo texto.
export function PoweredBy({ className }: { className?: string }) {
  const classes = cn(
    'inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground',
    className,
  );
  const content = (
    <>
      <LogoMark className="h-4 w-4" />
      {BRAND.poweredBy}
    </>
  );

  if (!webEnv.riffastWhatsapp) {
    return <span className={classes}>{content}</span>;
  }
  return (
    <a
      href={buildWhatsappLink(webEnv.riffastWhatsapp, '¡Hola *Riffast*! 👋 Quiero mi propia página de rifas como esta. 🎟️')}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
    >
      {content}
    </a>
  );
}

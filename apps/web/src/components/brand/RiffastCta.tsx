import { ArrowRight } from 'lucide-react';
import { BRAND, buildWhatsappLink } from '@riffast/shared';
import { webEnv } from '@/lib/env';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

// Cierre de marca a todo el ancho para el final de las páginas públicas:
// "Desarrollado por Riffast". El botón abre el WhatsApp de Riffast (configurable
// con VITE_RIFFAST_WHATSAPP) para quien quiera su propia página de rifas.
export function RiffastCta({ className }: { className?: string }) {
  const whatsappHref = webEnv.riffastWhatsapp
    ? buildWhatsappLink(webEnv.riffastWhatsapp, '¡Hola *Riffast*! 👋 Quiero mi propia página de rifas como esta. 🎟️')
    : null;

  return (
    <section
      className={cn(
        'relative isolate w-full overflow-hidden border-t border-white/10 bg-brand-ink px-6 py-12 text-center lg:py-16',
        className,
      )}
    >
      {/* Brillo verde muy tenue, centrado en la base */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 opacity-50"
        style={{ background: 'radial-gradient(55% 100% at 50% 100%, rgba(16,198,95,0.3), transparent 75%)' }}
      />

      <div className="mx-auto max-w-md lg:max-w-lg">
        {/* Logotipo */}
        <div className="mb-4 flex justify-center">
          <Logo tone="light" className="h-9" />
        </div>

        <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          Sitio desarrollado por Riffast
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-white/55">
          ¿Quieres tu propia página de rifas como esta? Escríbenos.
        </p>

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex items-center gap-2 rounded-full bg-brand-electric px-6 py-2.5 text-sm font-semibold text-brand-ink shadow-[0_12px_32px_-10px_rgba(16,198,95,0.7)] transition-colors hover:bg-brand"
          >
            Contactar por WhatsApp
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}

        <p className="mt-6 font-ticket text-[10px] uppercase tracking-[0.3em] text-white/30">
          {BRAND.poweredBy}
        </p>
      </div>
    </section>
  );
}

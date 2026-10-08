import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BRAND, buildWhatsappLink } from '@riffast/shared';
import { webEnv } from '@/lib/env';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

// Cierre de marca a todo el ancho para el final de las páginas públicas:
// "Desarrollado por Riffast". «Conoce Riffast» lleva al sitio de Riffast y, si
// está configurado VITE_RIFFAST_WHATSAPP, un botón abre su WhatsApp para quien
// quiera su propia página de rifas.
const RIFFAST_SITE = 'https://www.riffast.com';

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

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-electric px-6 py-2.5 text-sm font-semibold text-brand-ink shadow-[0_12px_32px_-10px_rgba(16,198,95,0.7)] transition-colors hover:bg-brand"
            >
              Contactar por WhatsApp
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}
          <a
            href={RIFFAST_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-4 text-[13px] font-semibold text-white/85 outline-none transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-electric/60"
          >
            Conoce Riffast
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </a>
        </div>

        <p className="mt-6 font-ticket text-[10px] uppercase tracking-[0.3em] text-white/30">
          {BRAND.poweredBy}
        </p>
      </div>
    </section>
  );
}

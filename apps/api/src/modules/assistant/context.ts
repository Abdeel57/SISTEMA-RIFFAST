// Contexto que se inyecta en cada mensaje (parte variable del prompt) y datos
// de la cuenta para los avisos al equipo.
import { formatPhone, fullDate, money, shortDate } from './format.js';
import type { ClientInfo } from './notify.js';
import type { ContextVars } from './prompt.js';
import type { ProfileInfo, RaffleLine, UserInfo } from './store.js';

const RAFFLE_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  PUBLISHED: 'publicada',
  FINISHED: 'finalizada',
  CANCELLED: 'cancelada',
};

export const NO_PHONE = 'no lo tenemos: pídeselo si hace falta llamarle';

export interface Account {
  user: UserInfo;
  profile: ProfileInfo;
  isAdmin: boolean;
}

export function roleLabel(acc: Account): string {
  if (acc.isAdmin) return 'administrador';
  return acc.user.sellerCode ? `vendedor (código ${acc.user.sellerCode})` : 'vendedor';
}

// Teléfono para llamarle: el del usuario; el administrador cae al WhatsApp de la página.
export function defaultPhone(acc: Account): string | null {
  const phone = acc.user.phone || (acc.isAdmin ? acc.profile.whatsapp : null);
  return phone && phone.replace(/\D/g, '').length >= 10 ? phone : null;
}

// "• Rifa de Italika (id r1) — publicada, 40/500 vendidos, $50 MXN c/u, sorteo lun 30 nov 20:00"
export function raffleLine(r: RaffleLine, currency: string, tz: string): string {
  const estado = `${RAFFLE_STATUS[r.status] ?? r.status}${r.hidden ? ' (oculta)' : ''}`;
  const sorteo = r.drawDate ? `sorteo ${shortDate(r.drawDate, tz)}` : 'sin fecha de sorteo';
  return `• ${r.title} (id ${r.id}) — ${estado}, ${r.soldCount}/${r.totalTickets} vendidos, ${money(r.ticketPrice, currency)} c/u, ${sorteo}`;
}

export function buildContextVars(
  acc: Account,
  raffles: RaffleLine[],
  opts: { siteUrl: string; timeZone: string; now: Date },
): ContextVars {
  const phone = defaultPhone(acc);
  const banks = acc.profile.paymentBanks;
  return {
    NOMBRE: `${acc.user.name} (página «${acc.profile.publicName}»)`,
    ROL: roleLabel(acc),
    URL_PAGINA: opts.siteUrl || '(sin dominio configurado)',
    PLAN: 'Completo: todas las funciones incluidas (no hay planes que activar)',
    TELEFONO: phone ? formatPhone(phone) : NO_PHONE,
    FECHA_HORA: fullDate(opts.now, opts.timeZone),
    ZONA: opts.timeZone,
    MONEDA: acc.profile.currency === 'USD' ? 'USD (dólares)' : 'MXN (pesos mexicanos)',
    DATOS_PAGO: banks.length ? `${banks.length} método${banks.length > 1 ? 's' : ''}: ${banks.join(', ')}` : 'sin configurar',
    RIFAS: raffles.length ? raffles.map((r) => raffleLine(r, acc.profile.currency, opts.timeZone)).join('\n') : '• Aún no tiene rifas.',
  };
}

export function clientInfo(acc: Account, siteUrl: string): ClientInfo {
  return {
    cliente: `${acc.profile.publicName} — ${acc.user.name} (${roleLabel(acc)})`,
    pagina: siteUrl || '(sin dominio)',
  };
}

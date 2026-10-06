// Textos de la vista previa al compartir (título y descripción de og:*), con la
// identidad del rifero. Los usan el HTML del sitio (lib/site-html.ts) y los
// enlaces /s/... (og.routes.ts) para que digan lo mismo.

import { formatMoney, isCurrency } from '@riffast/shared';
import { prisma } from '../../lib/prisma.js';

export interface ShareProfile {
  publicName: string;
  description: string | null;
  locale: string;
  currency: string;
}

export interface ShareRaffle {
  title: string;
  prize: string | null;
  ticketPrice: number;
  drawDate: Date | null;
  photoUrl: string | null; // primera foto del premio
}

const en = (p: ShareProfile) => p.locale === 'en';

// La descripción del rifero viene del editor de texto enriquecido: sin etiquetas.
function plain(text: string | null | undefined, max = 200): string {
  return (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function siteDescription(p: ShareProfile): string {
  return (
    plain(p.description) ||
    (en(p)
      ? `Join ${p.publicName}'s raffles. Reserve your tickets, pay easily and get your digital ticket with a QR code.`
      : `Participa en las rifas de ${p.publicName}. Aparta tus boletos, paga fácil y recibe tu boleto digital con QR.`)
  );
}

export function raffleTitle(r: ShareRaffle, p: ShareProfile): string {
  return `${r.title} · ${p.publicName}`;
}

export function raffleDescription(r: ShareRaffle, p: ShareProfile): string {
  const currency = isCurrency(p.currency) ? p.currency : 'MXN';
  const price = formatMoney(r.ticketPrice, currency);
  const date = r.drawDate
    ? new Intl.DateTimeFormat(en(p) ? 'en-US' : 'es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Mexico_City',
      }).format(r.drawDate)
    : null;
  const parts = en(p)
    ? [r.prize ? `Prize: ${plain(r.prize, 90)}` : null, `Tickets ${price}`, date ? `Draw: ${date}` : null]
    : [r.prize ? `Premio: ${plain(r.prize, 90)}` : null, `Boletos a ${price}`, date ? `Sorteo: ${date}` : null];
  const lead = parts.filter(Boolean).join(' · ');
  return `${lead}. ${en(p) ? 'Reserve your tickets online.' : 'Aparta tus boletos en línea.'}`;
}

// El panel siempre está en español (el idioma del sitio es para el comprador).
export const adminTitle = (p: Pick<ShareProfile, 'publicName'>) => `${p.publicName} · Panel de administración`;
export const ADMIN_DESCRIPTION = 'Entra para administrar tus rifas, apartados y pagos desde el celular.';

// /e3 → 3 (la ruta pública de una rifa); cualquier otra ruta → null.
export function eventNumberFromPath(path: string): number | null {
  const m = /^\/e(\d+)(?:\/|$)/i.exec(path);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// Rifa visible al público (publicada o ya sorteada y no oculta). Se cachea unos
// segundos: el HTML se pide en cada carga y no queremos pegarle a la BD cada vez.
const raffleCache = new Map<string, { at: number; data: ShareRaffle | null }>();
const TTL_MS = 30_000;

export async function findShareRaffle(riferoId: string, eventNumber: number): Promise<ShareRaffle | null> {
  const key = `${riferoId}:${eventNumber}`;
  const hit = raffleCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const r = await prisma.raffle.findFirst({
    where: { riferoId, eventNumber, status: { in: ['PUBLISHED', 'FINISHED'] }, hidden: false },
    select: {
      title: true,
      prize: true,
      ticketPrice: true,
      drawDate: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  });
  const data = r
    ? { title: r.title, prize: r.prize, ticketPrice: r.ticketPrice, drawDate: r.drawDate, photoUrl: r.images[0]?.url ?? null }
    : null;
  if (raffleCache.size > 100) raffleCache.clear();
  raffleCache.set(key, { at: Date.now(), data });
  return data;
}

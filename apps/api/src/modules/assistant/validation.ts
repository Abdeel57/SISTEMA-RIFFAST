// Validaciones del servidor para las herramientas del asistente. No se confía
// en lo que mande la IA: tarjeta (Luhn), CLABE (dígito de control), banco de la
// CLABE y fechas en la hora local del rifero.
import { digitsOnly, groupDigits, safeTimeZone } from './format.js';

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

// ── Tarjeta ──────────────────────────────────────────────────────────
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function validateCardNumber(raw: unknown): Check<string> {
  const d = digitsOnly(raw);
  if (d.length < 13 || d.length > 19) {
    return { ok: false, error: `El número de tarjeta debe tener de 13 a 19 dígitos (tiene ${d.length}). Revísalo.` };
  }
  if (!luhnValid(d)) {
    return { ok: false, error: `El número de tarjeta ${groupDigits(d)} no es válido: algún dígito está mal.` };
  }
  return { ok: true, value: d };
}

// ── CLABE ────────────────────────────────────────────────────────────
// Pesos 3,7,1 sobre los primeros 17 dígitos: suma de (dígito × peso) mod 10;
// control = (10 − suma mod 10) mod 10.
export function clabeControlDigit(first17: string): number {
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += ((first17.charCodeAt(i) - 48) * weights[i % 3]) % 10;
  return (10 - (sum % 10)) % 10;
}

export function clabeValid(digits: string): boolean {
  return /^\d{18}$/.test(digits) && clabeControlDigit(digits.slice(0, 17)) === Number(digits[17]);
}

export function validateClabe(raw: unknown): Check<string> {
  const d = digitsOnly(raw);
  if (d.length !== 18) return { ok: false, error: `La CLABE debe tener 18 dígitos (tiene ${d.length}). Revísala.` };
  if (!clabeValid(d)) return { ok: false, error: `La CLABE ${groupDigits(d)} no es válida: algún dígito está mal.` };
  return { ok: true, value: d };
}

// Banco según los primeros 3 dígitos de la CLABE.
export const CLABE_BANKS: Record<string, { name: string; aliases: string[] }> = {
  '002': { name: 'Banamex', aliases: ['banamex', 'citibanamex', 'citi'] },
  '012': { name: 'BBVA/Bancomer', aliases: ['bbva', 'bancomer'] },
  '014': { name: 'Santander', aliases: ['santander'] },
  '021': { name: 'HSBC', aliases: ['hsbc'] },
  '030': { name: 'BanBajío', aliases: ['banbajio', 'bajio'] },
  '036': { name: 'Inbursa', aliases: ['inbursa'] },
  '044': { name: 'Scotiabank', aliases: ['scotiabank', 'scotia'] },
  '058': { name: 'Banregio/Hey', aliases: ['banregio', 'hey'] },
  '062': { name: 'Afirme', aliases: ['afirme'] },
  '072': { name: 'Banorte', aliases: ['banorte'] },
  '127': { name: 'Azteca', aliases: ['azteca'] },
  '137': { name: 'BanCoppel', aliases: ['bancoppel', 'coppel'] },
  '166': { name: 'Bienestar', aliases: ['bienestar'] },
  '638': { name: 'Nu', aliases: ['nu', 'nubank'] },
  '722': { name: 'Mercado Pago', aliases: ['mercado pago', 'mercadopago'] },
};

export function clabeBank(clabe: string): string | null {
  return CLABE_BANKS[clabe.slice(0, 3)]?.name ?? null;
}

function normalizeBank(name: string): string {
  return ` ${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

// Aviso (no error) si la CLABE es de otro banco que el escrito.
export function clabeBankWarning(writtenBank: string, clabe: string): string | null {
  const entry = CLABE_BANKS[clabe.slice(0, 3)];
  if (!entry || !writtenBank.trim()) return null;
  const written = normalizeBank(writtenBank);
  if (entry.aliases.some((a) => written.includes(` ${a} `))) return null;
  return `La CLABE es de ${entry.name}, pero escribiste «${writtenBank.trim()}». Revisa que sea la cuenta correcta.`;
}

// Nunca se guardan vencimiento, CVV ni NIP (ni escondidos en una nota).
export function mentionsSensitiveCardData(text: string): boolean {
  return /\b(cvv|cvc|cvv2|nip|pin|vencimiento|vence|expira|exp)\b/i.test(text) || /\b(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\b/.test(text);
}

// ── Fechas ───────────────────────────────────────────────────────────
// Diferencia (ms) entre la hora local de `tz` y UTC en el instante `ts`.
function tzOffsetMs(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

// Convierte "AAAA-MM-DDTHH:MM" (hora local de `tz`) a un instante UTC. null si la
// fecha u hora no existe (31 de febrero, hueco del cambio de horario).
export function localDateTimeToUtc(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > daysInMonth) return null;

  const zone = safeTimeZone(tz);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMs(guess, zone);
  const second = guess - tzOffsetMs(utc, zone);
  if (second !== utc) utc = second;

  // Comprueba que la hora local resultante sea la pedida (si no, no existe).
  const back = utc + tzOffsetMs(utc, zone);
  const b = new Date(back);
  if (b.getUTCFullYear() !== y || b.getUTCMonth() !== mo - 1 || b.getUTCDate() !== d || b.getUTCHours() !== h || b.getUTCMinutes() !== mi) {
    return null;
  }
  return new Date(utc);
}

const MIN_AHEAD_MS = 15 * 60_000;
const MAX_AHEAD_MS = 2 * 366 * 24 * 60 * 60_000;

// Fecha del sorteo: futura, al menos 15 minutos y a lo más 2 años.
export function validateDrawDate(value: unknown, tz: string, now: Date = new Date()): Check<Date> {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim())) {
    return { ok: false, error: 'La fecha del sorteo debe venir como AAAA-MM-DDTHH:MM (por ejemplo 2026-11-30T20:00).' };
  }
  const date = localDateTimeToUtc(value, tz);
  if (!date) return { ok: false, error: `La fecha ${value.trim()} no existe. Revisa el día y la hora.` };
  const diff = date.getTime() - now.getTime();
  if (diff < 0) return { ok: false, error: 'Esa fecha ya pasó. Pídele una fecha futura para el sorteo.' };
  if (diff < MIN_AHEAD_MS) return { ok: false, error: 'El sorteo debe ser al menos 15 minutos después de ahora.' };
  if (diff > MAX_AHEAD_MS) return { ok: false, error: 'La fecha del sorteo no puede ser a más de 2 años.' };
  return { ok: true, value: date };
}

// Teléfono para llamadas: 10 dígitos (México) o con lada internacional.
export function validatePhone(raw: unknown): Check<string> {
  const d = digitsOnly(raw);
  if (d.length === 10 || (d.length >= 11 && d.length <= 13)) return { ok: true, value: d };
  return { ok: false, error: 'El teléfono debe tener 10 dígitos (por ejemplo 662 123 4567).' };
}

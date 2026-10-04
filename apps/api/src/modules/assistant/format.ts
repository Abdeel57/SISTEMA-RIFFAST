// Formatos para lo que ve el rifero (tarjetas de confirmación, contexto y
// avisos al equipo). Todo con Intl en es-MX.

export const DEFAULT_TIME_ZONE = 'America/Mexico_City';

// Zona horaria válida o el respaldo (centro de México).
export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz.trim()) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() });
    return tz.trim();
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// "$50 MXN" / "USD 50". Montos enteros (la plataforma guarda pesos enteros).
export function money(amount: number, currency: string = 'MXN'): string {
  const cur = currency === 'USD' ? 'USD' : 'MXN';
  const txt = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return cur === 'MXN' ? `${txt} MXN` : txt;
}

export function number(n: number): string {
  return n.toLocaleString('es-MX');
}

// "lunes, 30 de noviembre de 2026, 20:00"
export function fullDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: safeTimeZone(tz),
  }).format(date);
}

// "lun 30 nov 20:00"
export function shortDate(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: safeTimeZone(tz),
  }).formatToParts(date);
  const get = (t: string) => (parts.find((p) => p.type === t)?.value ?? '').replace(/\./g, '');
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('hour')}:${get('minute')}`;
}

export function digitsOnly(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '';
}

// "4152 3138 0000 1234" — tarjetas y CLABE de 4 en 4.
export function groupDigits(digits: string, size = 4): string {
  return (digits.match(new RegExp(`.{1,${size}}`, 'g')) ?? []).join(' ');
}

// "662 123 4567" (nacional) o "+52 662 123 4567".
export function formatPhone(raw: string): string {
  const d = digitsOnly(raw);
  const national = (n: string) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  if (d.length === 10) return national(d);
  if (d.length === 12 && d.startsWith('52')) return `+52 ${national(d.slice(2))}`;
  if (d.length === 13 && d.startsWith('521')) return `+52 ${national(d.slice(3))}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 ${national(d.slice(1))}`;
  return d;
}

export function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Quita etiquetas HTML (la descripción de la rifa viene del mini editor).
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

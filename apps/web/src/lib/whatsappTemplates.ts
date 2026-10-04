// Plantillas de WhatsApp del rifero para sus compradores (hoja «WhatsApp» de
// cada orden en Órdenes). TODAS viven aquí como funciones puras: reciben los
// datos ya calculados (de la base de datos de cada cliente) y devuelven el
// texto. Así después se pueden hacer editables desde Ajustes sin tocar la hoja.
// En WhatsApp, *texto* = negritas.
import type { PaymentMethodDTO } from '@riffast/shared';

export type WaTemplateId = 'conversacion' | 'recordatorio' | 'datos_pago' | 'confirmacion' | 'fecha_sorteo' | 'liberados';

export interface WaTemplateContext {
  nombre: string; // primer nombre, en formato normal («Juan»)
  rifa: string;
  boletos: string[]; // números elegidos, ya formateados («00003»)
  total: string; // ya formateado en la moneda del sitio
  folio: string;
  tiempoRestante: string | null; // «1h 59m»; null si no vence o ya venció
  datosPago: string | null; // bloques de métodos; null si no hay
  linkVerificador: string;
  linkRifa: string;
  fechaSorteo: string | null; // «sábado 17 de octubre, 8:00 p.m.»
}

// ── Utilidades de texto ──────────────────────────────────────────────
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

// «JUAN PEREZ» → «Juan»; «ángel» → «Ángel».
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  if (!first) return '';
  const lower = first.toLocaleLowerCase('es-MX');
  return lower.charAt(0).toLocaleUpperCase('es-MX') + lower.slice(1);
}

// Fecha larga del sorteo: «sábado 17 de octubre, 8:00 p.m.»
export function longDrawDate(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  const period = get('dayPeriod').replace(/\s+/g, '').toLowerCase(); // «p. m.» → «p.m.»
  return `${get('weekday')} ${get('day')} de ${get('month')}, ${get('hour')}:${get('minute')} ${period}`.trim();
}

// Un bloque por método configurado: banco, número(s) y titular. Los números
// van sin espacios para que el comprador los copie y pegue en su banco.
export function paymentBlocks(methods: PaymentMethodDTO[]): string | null {
  const blocks = methods
    .map((m) => {
      const lines = [`*${m.bank.trim()}*`];
      const digits = (v?: string | null) => (v ?? '').replace(/\s+/g, '');
      if (m.clabe?.trim()) lines.push(`CLABE: ${digits(m.clabe)}`);
      if (m.cardNumber?.trim()) lines.push(`Tarjeta: ${digits(m.cardNumber)}`);
      if (m.handle?.trim()) lines.push(`Usuario: ${m.handle.trim()}`);
      if (m.holderName?.trim()) lines.push(`Titular: ${m.holderName.trim()}`);
      return lines.length > 1 ? lines.join('\n') : null;
    })
    .filter((b): b is string => !!b);
  return blocks.length ? blocks.join('\n\n') : null;
}

// Une párrafos y quita los vacíos (p. ej. sin datos de pago o sin vencimiento).
const paragraphs = (...ps: (string | null | false | undefined)[]) => ps.filter((p): p is string => !!p).join('\n\n');

// ── Plantillas ───────────────────────────────────────────────────────
export function recordatorioPago(c: WaTemplateContext): string {
  const n = c.boletos.length;
  return paragraphs(
    `Hola ${c.nombre}, te recuerdo que tu apartado sigue pendiente de pago.`,
    [
      `Rifa: *${c.rifa}*`,
      `${plural(n, 'Boleto', 'Boletos')}: *${c.boletos.join(', ')}*`,
      `Total: *${c.total}*`,
    ].join('\n'),
    c.tiempoRestante &&
      `Vence en *${c.tiempoRestante}*; después ${plural(n, 'el boleto se libera', 'los boletos se liberan')}.`,
    c.datosPago,
    'Cuando pagues, mándame tu comprobante por aquí.',
  );
}

export function datosDePago(c: WaTemplateContext): string {
  const n = c.boletos.length;
  return paragraphs(
    `Hola ${c.nombre}, estos son los datos para pagar ${plural(n, 'tu boleto', 'tus boletos')} *${c.boletos.join(', ')}* (${c.total}):`,
    c.datosPago,
    [`En el concepto pon tu folio: *${c.folio}*`, 'Mándame tu comprobante por aquí y lo confirmo.'].join('\n'),
  );
}

export function confirmacionPago(c: WaTemplateContext): string {
  const n = c.boletos.length;
  return paragraphs(
    `¡Listo, ${c.nombre}! Tu pago quedó confirmado.`,
    [`Rifa: *${c.rifa}*`, `${plural(n, 'Boleto', 'Boletos')}: *${c.boletos.join(', ')}*`, `Folio: ${c.folio}`].join('\n'),
    `Verifica ${plural(n, 'tu boleto', 'tus boletos')} aquí: ${c.linkVerificador}`,
    '¡Mucha suerte!',
  );
}

export function fechaDelSorteo(c: WaTemplateContext): string {
  const n = c.boletos.length;
  return paragraphs(
    `Hola ${c.nombre}, te comparto la fecha del sorteo:`,
    [
      `Rifa: *${c.rifa}*`,
      `Fecha: *${c.fechaSorteo ?? ''}*`,
      `${plural(n, 'Tu boleto', 'Tus boletos')}: *${c.boletos.join(', ')}* (${plural(n, 'pagado', 'pagados')})`,
    ].join('\n'),
    '¡Mucha suerte!',
  );
}

export function boletosLiberados(c: WaTemplateContext): string {
  const n = c.boletos.length;
  // Al liberarse, los números se desligan de la orden y la API ya no los trae:
  // el mensaje se apoya en el folio.
  if (n === 0) {
    return `Hola ${c.nombre}, tu apartado con folio *${c.folio}* venció y se liberó. Si todavía lo quieres, vuelve a apartar aquí antes de que alguien más tome tus números: ${c.linkRifa}`;
  }
  return n === 1
    ? `Hola ${c.nombre}, tu apartado del boleto *${c.boletos[0]}* venció y el boleto se liberó. Si todavía lo quieres, vuelve a apartarlo aquí antes de que alguien más lo tome: ${c.linkRifa}`
    : `Hola ${c.nombre}, tu apartado de los boletos *${c.boletos.join(', ')}* venció y los boletos se liberaron. Si todavía los quieres, vuelve a apartarlos aquí antes de que alguien más los tome: ${c.linkRifa}`;
}

// Catálogo para la hoja: título y constructor de cada plantilla. «Ver
// conversación» abre el chat sin texto.
export const WA_TEMPLATES: Record<Exclude<WaTemplateId, 'conversacion'>, { titulo: string; build: (c: WaTemplateContext) => string }> = {
  recordatorio: { titulo: 'Recordatorio de pago', build: recordatorioPago },
  datos_pago: { titulo: 'Datos de pago', build: datosDePago },
  confirmacion: { titulo: 'Confirmación de pago', build: confirmacionPago },
  fecha_sorteo: { titulo: 'Fecha del sorteo', build: fechaDelSorteo },
  liberados: { titulo: 'Boletos liberados', build: boletosLiberados },
};

// wa.me: solo dígitos; un número nacional de 10 dígitos lleva la lada del
// comprador (52 México por defecto).
export function waLink(phone: string, dialCode: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.length === 10 ? `${dialCode}${digits}` : digits;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

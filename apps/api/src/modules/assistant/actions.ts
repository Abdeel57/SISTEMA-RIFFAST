// Herramientas de ESCRITURA. Nunca se ejecutan dentro del bucle de la IA:
//   prepare() valida y arma la tarjeta de confirmación (se guarda como acción
//             pendiente);
//   execute() corre solo cuando el rifero toca «Confirmar», llamando a la propia
//             API con su sesión (mismas reglas que los botones del panel).
import { randomUUID } from 'node:crypto';
import {
  createRaffleSchema,
  updateRaffleSchema,
  ORDER_PAYMENT_METHODS,
  RAFFLE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  buildWhatsappLink,
  dialCodeForCountry,
  formatPhoneIntl,
  formatTicketNumber,
  waTicketReadyMessage,
  type OrderDTO,
  type PaymentMethodDTO,
  type RaffleDTO,
  type RiferoProfileDTO,
} from '@riffast/shared';
import { ApiCallError, callApi, type ApiCaller } from './api.js';
import { digitsOnly, fullDate, groupDigits, money, number, stripHtml, truncate } from './format.js';
import type { ActionResult, Card, CardField } from './types.js';
import { clabeBankWarning, mentionsSensitiveCardData, validateCardNumber, validateClabe, validateDrawDate } from './validation.js';

export interface WriteContext {
  api: ApiCaller;
  timeZone: string;
  currency: 'MXN' | 'USD';
  siteUrl: string;
  now: () => Date;
}

export type Prepared = { ok: true; args: Record<string, unknown>; card: Card } | { ok: false; error: string };

export interface WriteTool {
  risk: boolean;
  prepare(ctx: WriteContext, args: Record<string, unknown>): Promise<Prepared>;
  execute(ctx: WriteContext, args: Record<string, unknown>): Promise<ActionResult>;
}

// ── Utilidades ───────────────────────────────────────────────────────
const MAX_PAYMENT_METHODS = 6;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const fail = (error: string): Prepared => ({ ok: false, error });

// Error pensado para el rifero dentro de execute().
function userError(message: string): never {
  throw new ApiCallError(409, message, false, null);
}

function str(v: unknown): string | undefined {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'si', 'sí', '1'].includes(s)) return true;
    if (['false', 'no', '0'].includes(s)) return false;
  }
  return undefined;
}

const yesNo = (b: boolean) => (b ? 'Sí' : 'No');

function firstZodError(result: { success: boolean; error?: { issues: { message: string }[] } }): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? 'Datos inválidos';
}

function ticketList(o: OrderDTO): string {
  const shown = o.ticketNumbers.slice(0, 20).join(', ');
  const more = o.ticketNumbers.length > 20 ? ` y ${o.ticketNumbers.length - 20} más` : '';
  const gifts = o.giftNumbers.length ? ` (+${o.giftNumbers.length} de regalo)` : '';
  return `${shown}${more}${gifts}`;
}

async function getProfile(api: ApiCaller): Promise<RiferoProfileDTO> {
  return (await callApi<{ profile: RiferoProfileDTO }>(api, 'GET', '/riferos/me')).profile;
}

async function getRaffle(api: ApiCaller, id: string): Promise<RaffleDTO> {
  return (await callApi<{ raffle: RaffleDTO }>(api, 'GET', `/raffles/${encodeURIComponent(id)}`)).raffle;
}

async function getOrder(api: ApiCaller, id: string): Promise<OrderDTO> {
  return (await callApi<{ order: OrderDTO }>(api, 'GET', `/orders/${encodeURIComponent(id)}`)).order;
}

// Métodos tal como los guarda la pantalla «Datos de pago» (sin nulls; el método
// legado sintetizado recibe un id propio).
type MethodInput = {
  id: string;
  bank: string;
  holderName: string;
  clabe: string;
  cardNumber: string;
  handle: string;
  concept: string;
  instructions: string;
};

const newMethodId = () => randomUUID().slice(0, 13);

function toMethodInputs(methods: PaymentMethodDTO[]): MethodInput[] {
  return methods.map((m) => ({
    id: m.id === 'legacy' ? newMethodId() : m.id,
    bank: m.bank ?? '',
    holderName: m.holderName ?? '',
    clabe: m.clabe ?? '',
    cardNumber: m.cardNumber ?? '',
    handle: m.handle ?? '',
    concept: m.concept ?? '',
    instructions: m.instructions ?? '',
  }));
}

// Mismo cuerpo que manda «Guardar datos de pago»: la lista y el espejo del
// primer método en los campos legados.
function paymentsPatch(methods: MethodInput[]) {
  const first = methods[0];
  return {
    paymentMethods: methods,
    payBank: first?.bank ?? '',
    payHolderName: first?.holderName ?? '',
    payClabe: first?.clabe ?? '',
    payCardNumber: first?.cardNumber ?? '',
    payConcept: first?.concept ?? '',
  };
}

function raffleLink(ctx: WriteContext, eventNumber: number): string {
  return `${ctx.siteUrl}/e${eventNumber}`;
}

// ── crear_rifa ───────────────────────────────────────────────────────
const crearRifa: WriteTool = {
  risk: false,
  async prepare(ctx, a) {
    const title = str(a.titulo);
    const prize = str(a.premio);
    const price = num(a.precio_boleto);
    const total = num(a.total_boletos);
    if (!title || title.length < 2) return fail('Falta el título de la rifa.');
    if (!prize) return fail('Falta el premio.');
    if (price === undefined || price <= 0) return fail('El precio por boleto debe ser mayor a 0.');
    if (!Number.isInteger(price)) return fail('El precio por boleto va en pesos enteros, sin centavos.');
    if (total === undefined || !Number.isInteger(total) || total <= 1) return fail('El total de boletos debe ser un número entero mayor a 1.');
    const draw = validateDrawDate(a.fecha_sorteo, ctx.timeZone, ctx.now());
    if (!draw.ok) return fail(draw.error);

    const ticketStart = num(a.numero_inicial) ?? 1;
    const opportunities = num(a.oportunidades) ?? 1;
    if (!Number.isInteger(ticketStart) || ticketStart < 0) return fail('El número inicial debe ser un entero de 0 en adelante.');
    if (!Number.isInteger(opportunities) || opportunities < 1 || opportunities > 50) return fail('Las oportunidades por boleto van de 1 a 50.');
    const lastNumber = ticketStart + total * opportunities - 1;
    const ticketFormat = num(a.digitos) ?? Math.max(3, String(lastNumber).length);
    const description = str(a.descripcion);
    const terms = str(a.terminos);
    const showCountdown = bool(a.mostrar_cuenta_regresiva) ?? true;
    const priceListRows = num(a.filas_tabla_precios) ?? 10;

    // Mismos valores por defecto que «Nueva rifa».
    const payload: Record<string, unknown> = {
      title,
      prize,
      ...(description ? { description } : {}),
      ticketPrice: price,
      totalTickets: total,
      ticketFormat,
      ticketStart,
      opportunities,
      drawDate: draw.value.toISOString(),
      showCountdown,
      manualSelection: true,
      comingSoon: false,
      allowWinnerPublication: true,
      useDigitalDraw: false,
      priceListRows,
      ...(terms ? { terms } : {}),
      images: [],
    };
    const invalid = firstZodError(createRaffleSchema.safeParse(payload));
    if (invalid) return fail(invalid);

    const campos: CardField[] = [
      { etiqueta: 'Título', valor: title },
      { etiqueta: 'Premio', valor: prize },
      { etiqueta: 'Precio por boleto', valor: money(price, ctx.currency), destacado: true },
      {
        etiqueta: 'Boletos',
        valor: `${number(total)} (del ${formatTicketNumber(ticketStart, ticketFormat)} al ${formatTicketNumber(ticketStart + total - 1, ticketFormat)})`,
      },
      { etiqueta: 'Si vendes todos', valor: money(price * total, ctx.currency) },
      { etiqueta: 'Sorteo', valor: fullDate(draw.value, ctx.timeZone) },
    ];
    if (opportunities > 1) campos.push({ etiqueta: 'Oportunidades por boleto', valor: `${opportunities} (con números de regalo)` });
    campos.push({ etiqueta: 'Cuenta regresiva', valor: yesNo(showCountdown) });
    if (description) campos.push({ etiqueta: 'Descripción', valor: truncate(stripHtml(description), 160) });
    if (terms) campos.push({ etiqueta: 'Términos', valor: truncate(terms, 160) });

    return {
      ok: true,
      args: { payload },
      card: {
        titulo: 'Crear rifa (borrador)',
        campos,
        avisos: [
          'Se guarda como borrador: todavía nadie la ve. Luego la publicas.',
          'El total de boletos no se puede cambiar después.',
          'Las fotos del premio se agregan en Editar.',
        ],
        boton: 'Crear borrador',
        riesgo: false,
      },
    };
  },
  async execute(ctx, a) {
    const payload = a.payload as Record<string, unknown>;
    const { raffle } = await callApi<{ raffle: RaffleDTO }>(ctx.api, 'POST', '/raffles', payload);
    return {
      ok: true,
      mensaje: `✅ Listo: creé «${raffle.title}» como borrador.`,
      enlace: { texto: 'Revisar y publicar', url: `/admin/rifas/${raffle.id}/editar` },
    };
  },
};

// ── editar_rifa ──────────────────────────────────────────────────────
const editarRifa: WriteTool = {
  risk: false,
  async prepare(ctx, a) {
    const id = str(a.rifa_id);
    if (!id) return fail('Falta rifa_id. Búscalo con ver_rifas.');
    if (a.total_boletos !== undefined) {
      return fail('El total de boletos no se puede cambiar. Si necesita otro total, que cree otra rifa.');
    }
    const r = await getRaffle(ctx.api, id);

    const payload: Record<string, unknown> = {};
    const campos: CardField[] = [{ etiqueta: 'Rifa', valor: `${r.title} (${r.eventLabel})` }];
    const avisos: string[] = [];
    const change = (etiqueta: string, antes: string, despues: string) =>
      campos.push({ etiqueta, valor: `${antes || '—'} → ${despues || '—'}` });

    const title = str(a.titulo);
    if (title && title !== r.title) {
      payload.title = title;
      change('Título', r.title, title);
    }
    const prize = str(a.premio);
    if (prize && prize !== (r.prize ?? '')) {
      payload.prize = prize;
      change('Premio', r.prize ?? '', prize);
    }
    const description = str(a.descripcion);
    if (description && description !== (r.description ?? '')) {
      payload.description = description;
      change('Descripción', truncate(stripHtml(r.description ?? ''), 60), truncate(stripHtml(description), 120));
    }
    if (a.precio_boleto !== undefined) {
      const price = num(a.precio_boleto);
      if (price === undefined || price <= 0) return fail('El precio por boleto debe ser mayor a 0.');
      if (!Number.isInteger(price)) return fail('El precio por boleto va en pesos enteros, sin centavos.');
      if (price !== r.ticketPrice) {
        payload.ticketPrice = price;
        campos.push({ etiqueta: 'Precio por boleto', valor: `${money(r.ticketPrice, ctx.currency)} → ${money(price, ctx.currency)}`, destacado: true });
        if (r.soldCount + r.reservedCount > 0) avisos.push('Ya hay boletos vendidos o apartados: el precio nuevo solo aplica a compras nuevas.');
      }
    }
    if (a.fecha_sorteo !== undefined) {
      const draw = validateDrawDate(a.fecha_sorteo, ctx.timeZone, ctx.now());
      if (!draw.ok) return fail(draw.error);
      const before = r.drawDate ? new Date(r.drawDate) : null;
      if (!before || before.getTime() !== draw.value.getTime()) {
        payload.drawDate = draw.value.toISOString();
        change('Sorteo', before ? fullDate(before, ctx.timeZone) : 'sin fecha', fullDate(draw.value, ctx.timeZone));
        if (r.status === 'PUBLISHED') avisos.push('La cuenta regresiva de tu página cambia a la nueva fecha.');
      }
    }
    const countdown = bool(a.mostrar_cuenta_regresiva);
    if (countdown !== undefined && countdown !== r.showCountdown) {
      payload.showCountdown = countdown;
      change('Cuenta regresiva', yesNo(r.showCountdown), yesNo(countdown));
    }
    const terms = str(a.terminos);
    if (terms && terms !== (r.terms ?? '')) {
      payload.terms = terms;
      change('Términos', truncate(r.terms ?? '', 60), truncate(terms, 120));
    }
    if (a.filas_tabla_precios !== undefined) {
      const rows = num(a.filas_tabla_precios);
      if (rows === undefined || !Number.isInteger(rows)) return fail('Las filas de la tabla de precios son un número entero de 1 a 50.');
      if (rows !== r.priceListRows) {
        payload.priceListRows = rows;
        change('Filas de la tabla de precios', String(r.priceListRows), String(rows));
      }
    }

    if (!Object.keys(payload).length) return fail('No veo ningún cambio respecto a lo que ya tiene la rifa. Pregúntale qué quiere cambiar.');
    const invalid = firstZodError(updateRaffleSchema.safeParse(payload));
    if (invalid) return fail(invalid);

    return {
      ok: true,
      args: { rifaId: r.id, titulo: r.title, payload },
      card: { titulo: 'Editar rifa', campos, avisos, boton: 'Guardar cambios', riesgo: false },
    };
  },
  async execute(ctx, a) {
    const id = String(a.rifaId);
    const { raffle } = await callApi<{ raffle: RaffleDTO }>(ctx.api, 'PATCH', `/raffles/${encodeURIComponent(id)}`, a.payload);
    return {
      ok: true,
      mensaje: `✅ Guardé los cambios de «${raffle.title}».`,
      enlace: { texto: 'Ver rifa', url: `/admin/rifas/${raffle.id}/editar` },
    };
  },
};

// ── publicar_rifa ────────────────────────────────────────────────────
const publicarRifa: WriteTool = {
  risk: false,
  async prepare(ctx, a) {
    const id = str(a.rifa_id);
    if (!id) return fail('Falta rifa_id. Búscalo con ver_rifas.');
    const r = await getRaffle(ctx.api, id);
    if (r.status === 'PUBLISHED') {
      return fail(
        r.hidden
          ? 'Esa rifa ya está publicada, pero oculta. Se muestra desde **Rifas → ⋯ → Mostrar en la página**.'
          : 'Esa rifa ya está publicada.',
      );
    }
    if (r.status === 'FINISHED' || r.status === 'CANCELLED') {
      return fail(`Esa rifa está ${RAFFLE_STATUS_LABELS[r.status].toLowerCase()}; ya no se puede publicar.`);
    }
    const profile = await getProfile(ctx.api);
    const avisos = ['Al publicarla, cualquiera con tu link podrá apartar boletos.'];
    if (!r.images.length) avisos.push('No tiene fotos del premio: agrégalas en Editar para vender más.');
    if (!profile.paymentMethods.length) avisos.push('Aún no tienes datos de pago: tus compradores no sabrán a dónde pagarte.');
    if (r.drawDate && new Date(r.drawDate).getTime() < ctx.now().getTime()) avisos.push('La fecha del sorteo ya pasó: cámbiala antes de vender.');

    return {
      ok: true,
      args: { rifaId: r.id, titulo: r.title, evento: r.eventNumber },
      card: {
        titulo: 'Publicar rifa',
        campos: [
          { etiqueta: 'Rifa', valor: `${r.title} (${r.eventLabel})` },
          { etiqueta: 'Precio por boleto', valor: money(r.ticketPrice, ctx.currency) },
          { etiqueta: 'Boletos', valor: number(r.totalTickets) },
          { etiqueta: 'Sorteo', valor: r.drawDate ? fullDate(new Date(r.drawDate), ctx.timeZone) : 'sin fecha' },
          { etiqueta: 'Link', valor: raffleLink(ctx, r.eventNumber) },
        ],
        avisos,
        boton: 'Publicar ahora',
        riesgo: false,
      },
    };
  },
  async execute(ctx, a) {
    const id = String(a.rifaId);
    const { raffle } = await callApi<{ raffle: RaffleDTO }>(ctx.api, 'POST', `/raffles/${encodeURIComponent(id)}/publish`);
    return {
      ok: true,
      mensaje: `✅ Publiqué «${raffle.title}». Tu link: ${raffleLink(ctx, raffle.eventNumber)}`,
      enlace: { texto: 'Ver en Rifas', url: '/admin/rifas' },
    };
  },
};

// ── agregar_metodo_pago ──────────────────────────────────────────────
const agregarMetodoPago: WriteTool = {
  risk: false,
  async prepare(ctx, a) {
    const bank = str(a.banco);
    const holder = str(a.titular);
    const concept = str(a.concepto) ?? '';
    const note = str(a.nota) ?? '';
    if (!bank) return fail('Falta el banco.');
    if (bank.length > 60) return fail('El nombre del banco es muy largo.');
    if (!holder) return fail('Falta el titular de la cuenta (como aparece en el banco).');
    if (holder.length > 120) return fail('El nombre del titular es muy largo.');
    if (concept.length > 120 || note.length > 500) return fail('El concepto o la nota son muy largos.');
    if ([bank, holder, concept, note].some(mentionsSensitiveCardData)) {
      return fail('No guardo vencimiento, CVV ni NIP. Quítalos y recuérdale no compartirlos con nadie.');
    }

    const cardRaw = digitsOnly(a.numero_tarjeta);
    const clabeRaw = digitsOnly(a.clabe);
    if (!cardRaw && !clabeRaw) return fail('Necesito el número de tarjeta o la CLABE (al menos uno).');
    let card = '';
    let clabe = '';
    if (cardRaw) {
      const c = validateCardNumber(cardRaw);
      if (!c.ok) return fail(c.error);
      card = c.value;
    }
    if (clabeRaw) {
      const c = validateClabe(clabeRaw);
      if (!c.ok) return fail(c.error);
      clabe = c.value;
    }

    const existing = (await getProfile(ctx.api)).paymentMethods;
    if (existing.length >= MAX_PAYMENT_METHODS) {
      return fail(`Ya tiene ${MAX_PAYMENT_METHODS} métodos de pago, que es el máximo. Primero hay que quitar uno.`);
    }
    const dup = existing.findIndex(
      (m) => (card && digitsOnly(m.cardNumber) === card) || (clabe && digitsOnly(m.clabe) === clabe),
    );
    if (dup >= 0) return fail(`Ese número ya está en sus datos de pago (método ${dup + 1}, ${existing[dup].bank}).`);

    const campos: CardField[] = [
      { etiqueta: 'Banco', valor: bank },
      { etiqueta: 'Titular', valor: holder },
    ];
    if (card) campos.push({ etiqueta: 'Número de tarjeta', valor: groupDigits(card), destacado: true });
    if (clabe) campos.push({ etiqueta: 'CLABE', valor: groupDigits(clabe), destacado: true });
    if (concept) campos.push({ etiqueta: 'Concepto', valor: concept });
    if (note) campos.push({ etiqueta: 'Nota', valor: note });

    const avisos = ['Revisa cada dígito antes de confirmar.'];
    const bankWarning = clabe ? clabeBankWarning(bank, clabe) : null;
    if (bankWarning) avisos.push(bankWarning);

    return {
      ok: true,
      // Nunca se guardan vencimiento ni CVV: solo estos campos.
      args: { method: { bank, holderName: holder, clabe, cardNumber: card, concept, instructions: note } },
      card: { titulo: 'Agregar método de pago', campos, avisos, boton: 'Agregar a mis datos de pago', riesgo: false },
    };
  },
  async execute(ctx, a) {
    const m = a.method as Omit<MethodInput, 'id' | 'handle'>;
    const methods = toMethodInputs((await getProfile(ctx.api)).paymentMethods);
    if (methods.length >= MAX_PAYMENT_METHODS) userError(`Ya tienes ${MAX_PAYMENT_METHODS} métodos de pago (el máximo). Quita uno primero.`);
    methods.push({ id: newMethodId(), handle: '', ...m });
    await callApi(ctx.api, 'PATCH', '/riferos/me', paymentsPatch(methods));
    return {
      ok: true,
      mensaje: `✅ Agregué tu método ${m.bank}. Ya aparece en **Más → Datos de pago**.`,
      enlace: { texto: 'Ver datos de pago', url: '/admin/pagos' },
    };
  },
};

// ── quitar_metodo_pago ───────────────────────────────────────────────
const quitarMetodoPago: WriteTool = {
  risk: true,
  async prepare(ctx, a) {
    const id = str(a.metodo_id);
    if (!id) return fail('Falta metodo_id. Búscalo con ver_datos_pago.');
    const methods = (await getProfile(ctx.api)).paymentMethods;
    const target = methods.find((m) => m.id === id);
    if (!target) return fail('No encontré ese método. Revisa los ids con ver_datos_pago.');

    const campos: CardField[] = [
      { etiqueta: 'Banco', valor: target.bank },
      { etiqueta: 'Titular', valor: target.holderName || '—' },
    ];
    if (target.cardNumber) campos.push({ etiqueta: 'Número de tarjeta', valor: groupDigits(digitsOnly(target.cardNumber)), destacado: true });
    if (target.clabe) campos.push({ etiqueta: 'CLABE', valor: groupDigits(digitsOnly(target.clabe)), destacado: true });
    const avisos = ['Tus compradores ya no verán esta cuenta para pagarte.'];
    if (methods.length === 1) avisos.push('Es tu único método: tus compradores no sabrán a dónde pagarte.');

    return {
      ok: true,
      args: { metodoId: target.id, banco: target.bank },
      card: { titulo: 'Quitar método de pago', campos, avisos, boton: 'Quitar método', riesgo: true },
    };
  },
  async execute(ctx, a) {
    const id = String(a.metodoId);
    const current = (await getProfile(ctx.api)).paymentMethods;
    if (!current.some((m) => m.id === id)) userError('Ese método ya no está en tus datos de pago.');
    const remaining = toMethodInputs(current.filter((m) => m.id !== id));
    await callApi(ctx.api, 'PATCH', '/riferos/me', paymentsPatch(remaining));
    return {
      ok: true,
      mensaje: `✅ Quité el método ${String(a.banco)} de tus datos de pago.`,
      enlace: { texto: 'Ver datos de pago', url: '/admin/pagos' },
    };
  },
};

// ── marcar_orden_pagada ──────────────────────────────────────────────
const CLOSED = new Set(['CANCELLED', 'REJECTED', 'EXPIRED']);

const marcarOrdenPagada: WriteTool = {
  risk: false,
  async prepare(ctx, a) {
    const id = str(a.orden_id);
    if (!id) return fail('Falta orden_id. Búscalo con ver_ordenes.');
    const method = str(a.forma_pago)?.toLowerCase();
    if (!method || !(ORDER_PAYMENT_METHODS as readonly string[]).includes(method)) {
      return fail('forma_pago debe ser: efectivo, transferencia, deposito, tarjeta u otro. Pregúntale cómo pagó.');
    }
    const note = str(a.detalles) ?? '';
    if (note.length > 200) return fail('Los detalles son muy largos (máximo 200 caracteres).');

    const o = await getOrder(ctx.api, id);
    if (o.status === 'PAID') return fail(`La orden ${o.code} ya está pagada.`);
    if (CLOSED.has(o.status)) {
      return fail(`La orden ${o.code} está ${ORDER_STATUS_LABELS[o.status].toLowerCase()}; ya no se puede marcar pagada. El comprador tiene que volver a apartar.`);
    }

    // Igual que «Marcar pagado» en Órdenes: WhatsApp con el boleto listo.
    const waPhone = o.buyer.whatsapp ?? o.buyer.phone;
    const ticketMessage = waTicketReadyMessage({
      raffleName: `${o.raffleTitle} (${o.eventLabel})`,
      ticketNumbers: o.ticketNumbers.join(', '),
      buyerName: o.buyer.fullName,
      ticketUrl: `${ctx.siteUrl}/boleto/${o.digitalTicketCode ?? o.code}`,
    });
    const whatsapp = waPhone
      ? { texto: 'Enviar boleto por WhatsApp', url: buildWhatsappLink(waPhone, ticketMessage, dialCodeForCountry(o.buyer.country)) }
      : undefined;

    const campos: CardField[] = [
      { etiqueta: 'Cliente', valor: o.buyer.fullName },
      { etiqueta: 'Teléfono', valor: formatPhoneIntl(o.buyer.phone, o.buyer.country) },
      { etiqueta: 'Folio', valor: o.code },
      { etiqueta: 'Rifa', valor: `${o.raffleTitle} (${o.eventLabel})` },
      { etiqueta: 'Boletos', valor: ticketList(o) },
      { etiqueta: 'Total', valor: money(o.totalAmount, ctx.currency), destacado: true },
      { etiqueta: '¿Cómo pagó?', valor: PAYMENT_METHOD_LABEL[method] },
    ];
    if (note) campos.push({ etiqueta: 'Detalles', valor: note });
    const avisos = ['Confírmalo solo si ya viste el dinero en tu cuenta.'];
    avisos.push(
      whatsapp
        ? 'Al confirmar se abre WhatsApp con su boleto listo para enviárselo.'
        : 'El comprador no tiene WhatsApp registrado: avísale tú.',
    );

    return {
      ok: true,
      args: { ordenId: o.id, folio: o.code, cliente: o.buyer.fullName, paymentMethod: method, paymentNote: note },
      card: { titulo: 'Marcar orden pagada', campos, avisos, boton: 'Sí, confirmar pago', riesgo: false, ...(whatsapp ? { whatsapp } : {}) },
    };
  },
  async execute(ctx, a) {
    const id = String(a.ordenId);
    await callApi(ctx.api, 'PATCH', `/orders/${encodeURIComponent(id)}/mark-paid`, {
      paymentMethod: a.paymentMethod,
      paymentNote: a.paymentNote ?? '',
    });
    return {
      ok: true,
      mensaje: `✅ Marqué pagada la orden ${String(a.folio)} de ${String(a.cliente)}.`,
      enlace: { texto: 'Ver pagadas', url: '/admin/ordenes/pagadas' },
    };
  },
};

// ── liberar_orden (solo apartados: lo mismo que «Cancelar apartado») ─
const PENDING = new Set(['RESERVED', 'PENDING']);

const liberarOrden: WriteTool = {
  risk: true,
  async prepare(ctx, a) {
    const id = str(a.orden_id);
    if (!id) return fail('Falta orden_id. Búscalo con ver_ordenes.');
    const o = await getOrder(ctx.api, id);
    if (o.status === 'PAID') {
      return fail(
        `La orden ${o.code} ya está pagada. Desde el chat solo libero apartados; para una pagada ve a **Órdenes → Pagadas → ⋯ → Liberar boletos** (ahí eliges si vuelve a apartado o a la venta).`,
      );
    }
    if (!PENDING.has(o.status)) {
      return fail(`La orden ${o.code} está ${ORDER_STATUS_LABELS[o.status].toLowerCase()}; sus boletos ya se liberaron.`);
    }
    const avisos = ['Sus boletos vuelven a estar disponibles para cualquiera.', 'Esto no se puede deshacer.'];
    if (o.hasProof) avisos.unshift('Ojo: esta orden tiene comprobante de pago. Revísalo antes de liberar.');
    return {
      ok: true,
      args: { ordenId: o.id, folio: o.code },
      card: {
        titulo: 'Liberar boletos (cancelar apartado)',
        campos: [
          { etiqueta: 'Cliente', valor: o.buyer.fullName },
          { etiqueta: 'Folio', valor: o.code },
          { etiqueta: 'Rifa', valor: `${o.raffleTitle} (${o.eventLabel})` },
          { etiqueta: 'Boletos', valor: ticketList(o) },
          { etiqueta: 'Total', valor: money(o.totalAmount, ctx.currency) },
        ],
        avisos,
        boton: 'Sí, liberar boletos',
        riesgo: true,
      },
    };
  },
  async execute(ctx, a) {
    const id = String(a.ordenId);
    // La orden pudo cambiar desde que se armó la tarjeta (p. ej. ya la pagaron).
    const o = await getOrder(ctx.api, id);
    if (!PENDING.has(o.status)) {
      userError(`La orden ${o.code} cambió (ahora está ${ORDER_STATUS_LABELS[o.status].toLowerCase()}): no liberé nada.`);
    }
    await callApi(ctx.api, 'PATCH', `/orders/${encodeURIComponent(id)}/cancel`);
    return {
      ok: true,
      mensaje: `✅ Liberé los boletos de la orden ${o.code}; ya están disponibles.`,
      enlace: { texto: 'Ver pendientes', url: '/admin/ordenes/pendientes' },
    };
  },
};

export const WRITE_TOOLS: Record<string, WriteTool> = {
  crear_rifa: crearRifa,
  editar_rifa: editarRifa,
  publicar_rifa: publicarRifa,
  agregar_metodo_pago: agregarMetodoPago,
  quitar_metodo_pago: quitarMetodoPago,
  marcar_orden_pagada: marcarOrdenPagada,
  liberar_orden: liberarOrden,
};

// Herramientas del asistente. Las descripciones son CORTAS: viajan en cada
// mensaje y cuestan tokens. Se filtran por rol antes de mandarlas a la IA y el
// rol se vuelve a validar aquí, en el backend, en cada llamada.
import {
  ORDER_STATUS_LABELS,
  formatPhoneIntl,
  type DashboardSummaryDTO,
  type OrderDTO,
  type RaffleDTO,
  type RiferoProfileDTO,
  type SellerStatsDTO,
} from '@riffast/shared';
import { WRITE_TOOLS, type WriteContext } from './actions.js';
import { ApiCallError, callApi, type ApiCaller } from './api.js';
import type { JsonSchema, ToolCall, ToolDef } from './ai/types.js';
import { formatPhone, fullDate, money, stripHtml, truncate } from './format.js';
import { callAlertText, reportAlertText, type ClientInfo, type Logger, type Notifier } from './notify.js';
import { GUIDE_TOPICS, guideSection } from './prompt.js';
import type { ActionRow, AssistantStore } from './store.js';
import { ACTION_TTL_MS, type CallView, type SessionAuth } from './types.js';
import { validatePhone } from './validation.js';

export interface ToolContext {
  auth: SessionAuth;
  isAdmin: boolean;
  api: ApiCaller;
  store: AssistantStore;
  notifier: Notifier;
  log: Logger;
  conversationId: string;
  timeZone: string;
  currency: 'MXN' | 'USD';
  siteUrl: string;
  marca: string;
  horario: string;
  sellerCode: string | null;
  client: ClientInfo;
  now: () => Date;
  // Lo que esta vuelta creó (tarjetas y llamada), para la respuesta HTTP.
  created: { actions: ActionRow[]; call: CallView | null };
}

type Kind = 'lectura' | 'escritura' | 'escalamiento';

interface ToolSpec {
  def: ToolDef;
  kind: Kind;
  adminOnly: boolean;
  run(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown>;
}

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});
const typed = (type: string, description?: string): JsonSchema => (description ? { type, description } : { type });
const s = (description?: string) => typed('string', description);
const n = (description?: string) => typed('number', description);
const b = (description?: string) => typed('boolean', description);
const e = (values: string[], description?: string): JsonSchema => ({ type: 'string', enum: values, ...(description ? { description } : {}) });

const RAFFLE_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  PUBLISHED: 'publicada',
  FINISHED: 'finalizada',
  CANCELLED: 'cancelada',
};

const PENDING_NOTE = { ok: true, estado: 'esperando_confirmacion', nota: 'El rifero ya ve la tarjeta. Todavía NO está hecho.' };

function writeContext(ctx: ToolContext): WriteContext {
  return { api: ctx.api, timeZone: ctx.timeZone, currency: ctx.currency, siteUrl: ctx.siteUrl, now: ctx.now };
}

function raffleSummary(ctx: ToolContext, r: RaffleDTO) {
  return {
    id: r.id,
    titulo: r.title,
    evento: r.eventLabel,
    estado: `${RAFFLE_STATUS[r.status] ?? r.status}${r.hidden ? ' (oculta)' : ''}`,
    vendidos: r.soldCount,
    apartados: r.reservedCount,
    total: r.totalTickets,
    precio: money(r.ticketPrice, ctx.currency),
    sorteo: r.drawDate ? fullDate(new Date(r.drawDate), ctx.timeZone) : 'sin fecha',
    link: `${ctx.siteUrl}/e${r.eventNumber}`,
  };
}

// ── Herramienta de escritura genérica: valida, arma tarjeta y la deja pendiente ─
function writeTool(name: string, def: Omit<ToolDef, 'name'>): ToolSpec {
  return {
    def: { name, ...def },
    kind: 'escritura',
    adminOnly: true,
    async run(ctx, args) {
      const tool = WRITE_TOOLS[name];
      const prepared = await tool.prepare(writeContext(ctx), args);
      if (!prepared.ok) return { ok: false, error: prepared.error };
      const action = await ctx.store.createAction({
        userId: ctx.auth.userId,
        riferoId: ctx.auth.riferoId,
        conversationId: ctx.conversationId,
        tool: name,
        args: prepared.args,
        card: prepared.card,
        expiresAt: new Date(ctx.now().getTime() + ACTION_TTL_MS),
      });
      ctx.created.actions.push(action);
      return PENDING_NOTE;
    },
  };
}

export const TOOL_SPECS: ToolSpec[] = [
  // ── Lectura ────────────────────────────────────────────────────────
  {
    def: {
      name: 'consultar_guia',
      description: 'Pasos exactos del administrador sobre un tema. Úsala antes de explicar cómo hacer algo.',
      parameters: obj({ tema: e([...GUIDE_TOPICS]) }, ['tema']),
    },
    kind: 'lectura',
    adminOnly: false,
    async run(ctx, a) {
      const tema = String(a.tema ?? '');
      const guia = guideSection(tema, ctx.marca);
      if (!guia) return { ok: false, error: `Tema desconocido. Usa uno de: ${GUIDE_TOPICS.join(', ')}.` };
      return { ok: true, tema, guia };
    },
  },
  {
    def: {
      name: 'ver_resumen',
      description: 'Números de la cuenta: por cobrar, pagadas, boletos vendidos e ingresos.',
      parameters: obj({}),
    },
    kind: 'lectura',
    adminOnly: false,
    async run(ctx) {
      if (!ctx.isAdmin) {
        const { stats } = await callApi<{ stats: SellerStatsDTO }>(ctx.api, 'GET', '/seller/me/stats');
        return {
          ok: true,
          deVendedor: true,
          vendidoPagado: money(stats.revenue, ctx.currency),
          boletosPagados: stats.ticketsSold,
          porCobrar: stats.pendingOrders,
          pagadas: stats.paidOrders,
          ordenes: stats.ordersTotal,
          canceladas: stats.cancelledOrders,
        };
      }
      const { summary } = await callApi<{ summary: DashboardSummaryDTO }>(ctx.api, 'GET', '/dashboard/summary');
      return {
        ok: true,
        porCobrar: summary.pendingOrders,
        pagadas: summary.paidOrders,
        vendidos: summary.soldTickets,
        apartados: summary.reservedTickets,
        ingresos: money(summary.estimatedRevenue, ctx.currency),
        rifasActivas: summary.activeRaffles,
        sorteosProximos: summary.upcomingDraws,
      };
    },
  },
  {
    def: {
      name: 'ver_rifas',
      description: 'Lista de rifas (máx. 20) con id, estado, vendidos/total, precio, fecha y link.',
      parameters: obj({}),
    },
    kind: 'lectura',
    adminOnly: false,
    async run(ctx) {
      if (!ctx.isAdmin) {
        // El vendedor solo ve las rifas públicas, con SU link de venta.
        const rows = await ctx.store.listRecentRaffles(ctx.auth.riferoId, { onlyPublic: true, take: 20 });
        return {
          ok: true,
          rifas: rows.map((r) => ({
            id: r.id,
            titulo: r.title,
            evento: `E${r.eventNumber}`,
            estado: RAFFLE_STATUS[r.status] ?? r.status,
            vendidos: r.soldCount,
            total: r.totalTickets,
            precio: money(r.ticketPrice, ctx.currency),
            sorteo: r.drawDate ? fullDate(r.drawDate, ctx.timeZone) : 'sin fecha',
            link: ctx.sellerCode ? `${ctx.siteUrl}/e${r.eventNumber}/${ctx.sellerCode}` : `${ctx.siteUrl}/e${r.eventNumber}`,
          })),
        };
      }
      const { items } = await callApi<{ items: RaffleDTO[] }>(ctx.api, 'GET', '/raffles');
      return { ok: true, total: items.length, rifas: items.slice(0, 20).map((r) => raffleSummary(ctx, r)) };
    },
  },
  {
    def: {
      name: 'ver_rifa',
      description: 'Detalle de una rifa.',
      parameters: obj({ rifa_id: s('id de ver_rifas') }, ['rifa_id']),
    },
    kind: 'lectura',
    adminOnly: false,
    async run(ctx, a) {
      const id = String(a.rifa_id ?? '').trim();
      if (!id) return { ok: false, error: 'Falta rifa_id. Búscalo con ver_rifas.' };
      if (!ctx.isAdmin) {
        const rows = await ctx.store.listRecentRaffles(ctx.auth.riferoId, { onlyPublic: true, take: 50 });
        const r = rows.find((x) => x.id === id);
        if (!r) return { ok: false, error: 'No encontré esa rifa entre las publicadas.' };
        return {
          ok: true,
          rifa: {
            id: r.id,
            titulo: r.title,
            evento: `E${r.eventNumber}`,
            vendidos: r.soldCount,
            total: r.totalTickets,
            precio: money(r.ticketPrice, ctx.currency),
            sorteo: r.drawDate ? fullDate(r.drawDate, ctx.timeZone) : 'sin fecha',
            link: ctx.sellerCode ? `${ctx.siteUrl}/e${r.eventNumber}/${ctx.sellerCode}` : `${ctx.siteUrl}/e${r.eventNumber}`,
          },
        };
      }
      const { raffle: r } = await callApi<{ raffle: RaffleDTO }>(ctx.api, 'GET', `/raffles/${encodeURIComponent(id)}`);
      return {
        ok: true,
        rifa: {
          ...raffleSummary(ctx, r),
          premio: r.prize,
          descripcion: r.description ? truncate(stripHtml(r.description), 400) : null,
          disponibles: r.availableCount,
          numeracion: `del ${String(r.ticketStart).padStart(r.ticketFormat, '0')} al ${String(r.ticketEnd).padStart(r.ticketFormat, '0')}`,
          oportunidades: r.opportunities,
          maxPorCompra: r.maxTicketsPerOrder,
          cuentaRegresiva: r.showCountdown,
          proximamente: r.comingSoon,
          seleccionManual: r.manualSelection,
          minutosParaApartar: r.reserveMinutes,
          filasTablaPrecios: r.priceListRows,
          preciosPorCantidad: r.pricingTiers.map((t) => `desde ${t.minQty}: ${money(t.unitPrice, ctx.currency)} c/u`),
          paquetes: r.pricingBundles.map((p) => `${p.qty} por ${money(p.price, ctx.currency)}`),
          promocion: r.promoEnabled ? r.promoTitle : null,
          fotos: r.images.length,
          terminos: r.terms ? truncate(r.terms, 300) : null,
          ingresos: money(r.estimatedRevenue, ctx.currency),
        },
      };
    },
  },
  {
    def: {
      name: 'ver_datos_pago',
      description: 'Métodos de pago configurados (con id) y ajustes generales de pago.',
      parameters: obj({}),
    },
    kind: 'lectura',
    adminOnly: true,
    async run(ctx) {
      const { profile } = await callApi<{ profile: RiferoProfileDTO }>(ctx.api, 'GET', '/riferos/me');
      return {
        ok: true,
        metodos: profile.paymentMethods.map((m) => ({
          id: m.id,
          banco: m.bank,
          titular: m.holderName || null,
          tarjeta: m.cardNumber || null,
          clabe: m.clabe || null,
          usuario: m.handle || null,
          concepto: m.concept || null,
          nota: m.instructions || null,
        })),
        maximo: 6,
        whatsappComprobantes: profile.payWhatsapp || '(usa el WhatsApp de su Perfil)',
        quienRecibe: profile.payWhatsappName || null,
        instrucciones: profile.payInstructions || null,
        subirComprobante: profile.allowProofUpload,
      };
    },
  },
  {
    def: {
      name: 'ver_ordenes',
      description: 'Busca órdenes (máx. 10). Sin buscar → pendientes de pago.',
      parameters: obj({
        estado: e(['pendientes', 'pagadas', 'todas']),
        buscar: s('nombre, teléfono, folio o número de boleto'),
        rifa_id: s('opcional'),
      }),
    },
    kind: 'lectura',
    adminOnly: false,
    async run(ctx, a) {
      const buscar = typeof a.buscar === 'string' ? a.buscar.trim() : '';
      const estado = ['pendientes', 'pagadas', 'todas'].includes(String(a.estado)) ? String(a.estado) : buscar ? 'todas' : 'pendientes';
      const status = estado === 'pendientes' ? 'pending' : estado === 'pagadas' ? 'paid' : 'all';
      const query = new URLSearchParams({ status });
      if (buscar) query.set('q', buscar.slice(0, 80));
      if (typeof a.rifa_id === 'string' && a.rifa_id.trim()) query.set('raffleId', a.rifa_id.trim());
      const { items } = await callApi<{ items: OrderDTO[] }>(ctx.api, 'GET', `/orders?${query.toString()}`);
      return {
        ok: true,
        filtro: estado,
        total: items.length >= 500 ? '500 o más' : items.length,
        mostrando: Math.min(10, items.length),
        ordenes: items.slice(0, 10).map((o) => ({
          id: o.id,
          folio: o.code,
          cliente: o.buyer.fullName,
          telefono: formatPhoneIntl(o.buyer.phone, o.buyer.country),
          rifa: `${o.raffleTitle} (${o.eventLabel})`,
          boletos: o.ticketNumbers.length > 15 ? `${o.ticketNumbers.slice(0, 15).join(', ')} y ${o.ticketNumbers.length - 15} más` : o.ticketNumbers.join(', '),
          regalos: o.giftNumbers.length || undefined,
          total: money(o.totalAmount, ctx.currency),
          estado: ORDER_STATUS_LABELS[o.status] ?? o.status,
          vence: o.expiresAt && (o.status === 'RESERVED' || o.status === 'PENDING') ? fullDate(new Date(o.expiresAt), ctx.timeZone) : undefined,
          pagada: o.paidAt ? fullDate(new Date(o.paidAt), ctx.timeZone) : undefined,
          comprobante: o.hasProof,
          vendedor: o.seller?.name,
          creada: fullDate(new Date(o.createdAt), ctx.timeZone),
        })),
      };
    },
  },

  // ── Escritura (tarjeta de confirmación; nunca se ejecutan aquí) ────
  writeTool('crear_rifa', {
    description: 'Crea una rifa como BORRADOR. Fecha en hora local del rifero.',
    parameters: obj(
      {
        titulo: s('ej. "Rifa de Italika FT150"'),
        premio: s('qué se rifa'),
        precio_boleto: n('pesos enteros'),
        total_boletos: n('entero > 1; no se puede cambiar después'),
        fecha_sorteo: s('AAAA-MM-DDTHH:MM'),
        descripcion: s('opcional'),
        numero_inicial: n('opcional, default 1'),
        digitos: n('opcional, dígitos del número (ej. 3 → 001)'),
        oportunidades: n('opcional, 1-50; >1 regala números'),
        mostrar_cuenta_regresiva: b('opcional, default sí'),
        terminos: s('opcional'),
        filas_tabla_precios: n('opcional, 1-50'),
      },
      ['titulo', 'premio', 'precio_boleto', 'total_boletos', 'fecha_sorteo'],
    ),
  }),
  writeTool('editar_rifa', {
    description: 'Cambia datos de una rifa. Manda solo lo que cambia. El total de boletos no se cambia.',
    parameters: obj(
      {
        rifa_id: s('id de ver_rifas'),
        titulo: s(),
        premio: s(),
        descripcion: s(),
        precio_boleto: n('pesos enteros'),
        fecha_sorteo: s('AAAA-MM-DDTHH:MM'),
        mostrar_cuenta_regresiva: b(),
        terminos: s(),
        filas_tabla_precios: n('1-50'),
      },
      ['rifa_id'],
    ),
  }),
  writeTool('publicar_rifa', {
    description: 'Publica una rifa (la hace visible y empieza a vender).',
    parameters: obj({ rifa_id: s('id de ver_rifas') }, ['rifa_id']),
  }),
  writeTool('agregar_metodo_pago', {
    description: 'Agrega una cuenta para que le paguen. Requiere titular y tarjeta o CLABE. Nunca vencimiento ni CVV.',
    parameters: obj(
      {
        banco: s(),
        titular: s('como aparece en el banco'),
        numero_tarjeta: s('solo dígitos'),
        clabe: s('18 dígitos'),
        concepto: s('opcional'),
        nota: s('opcional'),
      },
      ['banco', 'titular'],
    ),
  }),
  writeTool('quitar_metodo_pago', {
    description: 'Quita un método de pago.',
    parameters: obj({ metodo_id: s('id de ver_datos_pago') }, ['metodo_id']),
  }),
  writeTool('marcar_orden_pagada', {
    description: 'Marca una orden como pagada (igual que «Marcar pagado»).',
    parameters: obj(
      {
        orden_id: s('id de ver_ordenes'),
        forma_pago: e(['efectivo', 'transferencia', 'deposito', 'tarjeta', 'otro']),
        detalles: s('opcional: referencia, banco…'),
      },
      ['orden_id', 'forma_pago'],
    ),
  }),
  writeTool('liberar_orden', {
    description: 'Libera los boletos de un apartado sin pagar (cancela el apartado).',
    parameters: obj({ orden_id: s('id de ver_ordenes') }, ['orden_id']),
  }),

  // ── Escalamiento ───────────────────────────────────────────────────
  {
    def: {
      name: 'agendar_llamada',
      description: 'Pide al equipo que le llame. Solo si no se resolvió Y es urgente. Confirma antes el teléfono.',
      parameters: obj(
        {
          telefono: s('10 dígitos'),
          motivo: s('el problema en 1-2 líneas'),
          urgencia: e(['alta', 'media']),
          ya_se_intento: s('qué se probó'),
        },
        ['telefono', 'motivo', 'urgencia'],
      ),
    },
    kind: 'escalamiento',
    adminOnly: false,
    async run(ctx, a) {
      const phone = validatePhone(a.telefono);
      if (!phone.ok) return { ok: false, error: phone.error };
      const motivo = String(a.motivo ?? '').trim().slice(0, 500);
      if (!motivo) return { ok: false, error: 'Falta el motivo de la llamada.' };
      const urgencia = a.urgencia === 'media' ? 'media' : 'alta';
      const intento = typeof a.ya_se_intento === 'string' ? a.ya_se_intento.trim().slice(0, 500) : '';
      const result = await scheduleCall(ctx, { phone: phone.value, reason: motivo, urgency: urgencia, attempted: intento || null });
      return result.duplicate
        ? { ok: true, estado: 'ya_agendada', telefono: result.view.telefono, nota: 'Ya había una llamada pedida hace poco; el equipo ya está avisado.' }
        : { ok: true, estado: 'agendada', telefono: result.view.telefono, horario: ctx.horario };
    },
  },
  {
    def: {
      name: 'registrar_reporte',
      description: 'Deja un reporte al equipo (falla, duda sin resolver o sugerencia) cuando no es urgente.',
      parameters: obj(
        {
          tipo: e(['falla', 'duda_sin_resolver', 'sugerencia']),
          descripcion: s(),
        },
        ['tipo', 'descripcion'],
      ),
    },
    kind: 'escalamiento',
    adminOnly: false,
    async run(ctx, a) {
      const tipo = ['falla', 'duda_sin_resolver', 'sugerencia'].includes(String(a.tipo)) ? String(a.tipo) : 'duda_sin_resolver';
      const descripcion = String(a.descripcion ?? '').trim().slice(0, 1000);
      if (!descripcion) return { ok: false, error: 'Falta la descripción del reporte.' };
      await ctx.store.createReport({ userId: ctx.auth.userId, riferoId: ctx.auth.riferoId, type: tipo, description: descripcion });
      void ctx.notifier
        .send({
          tipo: 'reporte',
          texto: reportAlertText(ctx.marca, ctx.client, { type: tipo, description: descripcion, at: ctx.now() }),
          datos: { reporte: tipo, descripcion, ...ctx.client },
        })
        .catch(() => {});
      return { ok: true, estado: 'registrado' };
    },
  },
];

const TOOL_MAP = new Map(TOOL_SPECS.map((t) => [t.def.name, t]));

// Herramientas que se mandan a la IA según el rol.
export function toolsForRole(isAdmin: boolean): ToolDef[] {
  return TOOL_SPECS.filter((t) => isAdmin || !t.adminOnly).map((t) => t.def);
}

export function isWriteTool(name: string): boolean {
  return TOOL_MAP.get(name)?.kind === 'escritura';
}

// Ejecuta una llamada de la IA. Nunca lanza: los errores vuelven a la IA como
// { ok:false, error } para que los explique.
export async function runTool(ctx: ToolContext, call: ToolCall): Promise<unknown> {
  const spec = TOOL_MAP.get(call.name);
  if (!spec) return { ok: false, error: `No existe la herramienta "${call.name}".` };
  if (call.invalidArgs !== undefined) {
    return { ok: false, error: 'Los argumentos no eran JSON válido. Vuelve a llamar la herramienta con JSON correcto.' };
  }
  // Revalidación de rol en el backend, aunque la IA no debió tener la herramienta.
  if (spec.adminOnly && !ctx.isAdmin) {
    return {
      ok: false,
      error:
        spec.kind === 'escritura'
          ? 'Los vendedores no pueden hacer cambios desde el chat: los hace un administrador de la cuenta.'
          : 'Esta consulta solo la puede ver un administrador de la cuenta.',
    };
  }
  try {
    return await spec.run(ctx, call.args && typeof call.args === 'object' ? call.args : {});
  } catch (err) {
    if (err instanceof ApiCallError) {
      if (err.technical) ctx.log.error({ tool: call.name, status: err.status, detail: err.detail }, 'Asistente: la API falló en una herramienta');
      return { ok: false, error: err.message };
    }
    ctx.log.error({ tool: call.name, err: (err as Error)?.message }, 'Asistente: error en una herramienta');
    return { ok: false, error: 'No pude completar esto por un error interno. Intenta de nuevo; si sigue, ofrece la llamada.' };
  }
}

// ── Llamadas (también las usa el botón «Pedir llamada», sin IA) ──────
export interface CallContext {
  auth: SessionAuth;
  store: AssistantStore;
  notifier: Notifier;
  log: Logger;
  conversationId: string | null;
  marca: string;
  horario: string;
  client: ClientInfo;
  now: () => Date;
  created: { call: CallView | null };
}

export async function scheduleCall(
  ctx: CallContext,
  data: { phone: string; reason: string; urgency: 'alta' | 'media'; attempted: string | null },
): Promise<{ duplicate: boolean; view: CallView }> {
  const now = ctx.now();
  const recent = await ctx.store.findRecentCall(ctx.auth.userId, new Date(now.getTime() - 30 * 60_000));
  if (recent) {
    const view = { id: recent.id, telefono: formatPhone(recent.phone), horario: ctx.horario, fecha: recent.createdAt.toISOString() };
    return { duplicate: true, view };
  }
  const call = await ctx.store.createCall({
    userId: ctx.auth.userId,
    riferoId: ctx.auth.riferoId,
    conversationId: ctx.conversationId,
    phone: data.phone,
    reason: data.reason,
    urgency: data.urgency,
    attempted: data.attempted,
  });
  // Llega al instante; si el canal falla, el chat sigue (queda en logs y en BD).
  await ctx.notifier
    .send({
      tipo: 'llamada',
      texto: callAlertText(ctx.marca, ctx.client, { phone: call.phone, reason: call.reason, urgency: call.urgency, attempted: call.attempted, at: call.createdAt }),
      datos: { telefono: call.phone, motivo: call.reason, urgencia: call.urgency, yaSeIntento: call.attempted, ...ctx.client },
    })
    .catch((err) => ctx.log.error({ err: (err as Error)?.message }, 'Asistente: no se pudo avisar la llamada'));
  const view = { id: call.id, telefono: formatPhone(call.phone), horario: ctx.horario, fecha: call.createdAt.toISOString() };
  ctx.created.call = view;
  return { duplicate: false, view };
}

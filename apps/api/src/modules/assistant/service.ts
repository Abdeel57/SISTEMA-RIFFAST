// Orquestación de «Asistencia 24 h»: mensajes, confirmaciones, llamadas.
// El usuario y la cuenta salen SIEMPRE de la sesión (SessionAuth); nada de lo
// que diga la IA decide a qué cuenta se le hacen cambios.
import { AgentError, EMPTY_REPLY, runAgent } from './agent.js';
import type { AiStatus } from './ai/client.js';
import { AiError } from './ai/http.js';
import type { NeutralMessage, UserMessage } from './ai/types.js';
import { WRITE_TOOLS } from './actions.js';
import { ApiCallError, TECHNICAL_ERROR, type ApiCaller } from './api.js';
import { buildContextVars, clientInfo, defaultPhone, type Account } from './context.js';
import { safeTimeZone } from './format.js';
import { aiDownAlertText, createAlertThrottle, type Logger, type Notifier } from './notify.js';
import { buildSystemPrompt, NOTA_SIN_IMAGENES } from './prompt.js';
import type { AssistantSettings } from './settings.js';
import type { ActionRow, AssistantStore, CallRow, ConversationRow, MessageRow } from './store.js';
import { runTool, scheduleCall, toolsForRole, type ToolContext } from './tools.js';
import { isAdminRole, type ActionResult, type ActionStatus, type ActionView, type CallView, type SessionAuth } from './types.js';
import { formatPhone } from './format.js';
import { validatePhone } from './validation.js';

export const AI_DOWN_TEXT =
  'Ahorita no puedo contestar. Intenta de nuevo en un momento; si es urgente, pide una llamada y te contactamos.';
export const LIMIT_TEXT =
  'Llegaste al límite de mensajes de hoy. Si es urgente, pide una llamada y te contactamos.';
export const CANCEL_TEXT = 'Cancelado, no cambié nada. ¿Qué ajustamos?';
export const EXPIRED_TEXT = 'Expiró, pídemelo de nuevo.';
export const REVIEW_CARD_TEXT = 'Revisa los datos en la tarjeta y toca **Confirmar**.';

const MAX_TEXT = 2000;
const MAX_IMAGES = 2;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALERT_TYPES = new Set(['clave', 'limite', 'modelo', 'config']);

const SUGGESTIONS_ADMIN = ['Crear una rifa', 'Agregar mis datos de pago', '¿Cómo vendo más boletos?', 'Revisar pagos pendientes'];
const SUGGESTIONS_SELLER = ['¿Cuánto llevo vendido?', '¿Cómo comparto mi link?', '¿Cómo vendo más boletos?'];

export interface RequestInfo {
  auth: SessionAuth;
  api: ApiCaller;
  siteUrl: string;
}

export interface ServiceDeps {
  store: AssistantStore;
  ai: () => AiStatus;
  notifier: Notifier;
  settings: () => AssistantSettings;
  log: Logger;
  now?: () => Date;
  throttle?: { shouldSend(key: string): boolean };
}

export type MessageState = 'ok' | 'inactivo' | 'limite' | 'error' | 'invalido';

export interface MessageResponse {
  estado: MessageState;
  texto: string;
  acciones: ActionView[];
  llamada?: CallView;
  permitirLlamada?: boolean;
}

export type ConversationItem =
  | { tipo: 'mensaje'; id: string; rol: 'user' | 'assistant'; texto: string; fecha: string }
  | ({ tipo: 'accion' } & ActionView)
  | ({ tipo: 'llamada' } & CallView);

export class AssistantHttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ── Utilidades ───────────────────────────────────────────────────────
function actionView(a: ActionRow, now: Date): ActionView {
  const expired = a.status === 'pendiente' && a.expiresAt.getTime() <= now.getTime();
  return {
    id: a.id,
    herramienta: a.tool,
    tarjeta: a.card,
    estado: expired ? 'expirada' : a.status,
    resultado: a.result,
    fecha: a.createdAt.toISOString(),
  };
}

function callView(c: CallRow, horario: string): CallView {
  return { id: c.id, telefono: formatPhone(c.phone), horario, fecha: c.createdAt.toISOString() };
}

// Mensaje del sistema para el historial de la IA. `oculto` = no se pinta como
// burbuja (la tarjeta ya muestra el resultado).
function systemNote(content: string, accion: string | null, oculto: boolean): NeutralMessage {
  return { role: 'assistant', content, raw: { proveedor: 'sistema', accion, oculto } };
}

function isHidden(m: NeutralMessage): boolean {
  return m.role === 'assistant' && m.raw?.proveedor === 'sistema' && m.raw.oculto === true;
}

interface ParsedInput {
  texto: string;
  imagenes: { mimeType: string; data: string }[];
  timeZone: string;
  reintentar: boolean;
}

export function parseMessageInput(body: unknown): { ok: true; value: ParsedInput } | { ok: false; error: string } {
  const b = (body ?? {}) as { texto?: unknown; imagenes?: unknown; zonaHoraria?: unknown; reintentar?: unknown };
  const texto = typeof b.texto === 'string' ? b.texto.trim() : '';
  if (texto.length > MAX_TEXT) return { ok: false, error: 'Tu mensaje es muy largo (máximo 2,000 caracteres).' };
  const rawImages = Array.isArray(b.imagenes) ? b.imagenes : [];
  if (rawImages.length > MAX_IMAGES) return { ok: false, error: 'Puedes mandar hasta 2 fotos por mensaje.' };
  const imagenes: ParsedInput['imagenes'] = [];
  for (const img of rawImages) {
    const i = (img ?? {}) as { mimeType?: unknown; data?: unknown };
    const mimeType = typeof i.mimeType === 'string' ? i.mimeType.toLowerCase() : '';
    let data = typeof i.data === 'string' ? i.data : '';
    data = data.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (!IMAGE_TYPES.has(mimeType)) return { ok: false, error: 'Solo puedo recibir fotos JPG, PNG o WEBP.' };
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { ok: false, error: 'No pude leer la foto. Intenta mandarla otra vez.' };
    const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
    if (bytes > MAX_IMAGE_BYTES) return { ok: false, error: 'Cada foto puede pesar hasta 4 MB.' };
    imagenes.push({ mimeType, data });
  }
  if (!texto && !imagenes.length) return { ok: false, error: 'Escribe tu mensaje.' };
  return { ok: true, value: { texto, imagenes, timeZone: safeTimeZone(b.zonaHoraria), reintentar: b.reintentar === true } };
}

function storedUserContent(texto: string, images: number): string {
  if (!images) return texto;
  const note = `[Adjuntó ${images} imagen${images > 1 ? 'es' : ''}]`;
  return texto ? `${texto}\n${note}` : note;
}

// ── Servicio ─────────────────────────────────────────────────────────
export function createAssistantService(deps: ServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const throttle = deps.throttle ?? createAlertThrottle();
  const { store, log } = deps;

  async function loadAccount(auth: SessionAuth): Promise<Account> {
    const [user, profile] = await Promise.all([store.getUser(auth.userId), store.getProfile(auth.riferoId)]);
    if (!user || !profile) throw new AssistantHttpError(403, 'Tu cuenta no está vinculada a una página.');
    return { user, profile, isAdmin: isAdminRole(auth.role) };
  }

  async function activeConversation(auth: SessionAuth, timeZone: string): Promise<ConversationRow> {
    const conv = await store.findActiveConversation(auth.userId);
    if (conv && conv.riferoId === auth.riferoId) {
      if (conv.timeZone !== timeZone) await store.setConversationTimeZone(conv.id, timeZone);
      return { ...conv, timeZone };
    }
    if (conv) await store.deactivateConversations(auth.userId);
    return store.createConversation({ userId: auth.userId, riferoId: auth.riferoId, timeZone });
  }

  function alertAiDown(err: AiError, acc: Account | null, siteUrl: string): void {
    if (!ALERT_TYPES.has(err.tipo) || !throttle.shouldSend(err.tipo)) return;
    const s = deps.settings();
    const client = acc ? clientInfo(acc, siteUrl) : { cliente: '(desconocido)', pagina: siteUrl || '(sin dominio)' };
    void deps.notifier
      .send({
        tipo: 'ia_caida',
        texto: aiDownAlertText(s.marca, client, { tipo: err.tipo, detalle: err.message, at: now() }),
        datos: { error: err.tipo, detalle: err.message, ...client },
      })
      .catch(() => {});
  }

  return {
    async estado(auth: SessionAuth) {
      const st = deps.ai();
      const acc = await loadAccount(auth).catch(() => null);
      return {
        activo: st.configured,
        imagenes: st.client?.config.vision ?? false,
        sugerencias: isAdminRole(auth.role) ? SUGGESTIONS_ADMIN : SUGGESTIONS_SELLER,
        telefono: acc ? (defaultPhone(acc) ?? '') : '',
      };
    },

    async conversacion(auth: SessionAuth): Promise<{ items: ConversationItem[] }> {
      const conv = await store.findActiveConversation(auth.userId);
      if (!conv || conv.riferoId !== auth.riferoId) return { items: [] };
      const [messages, actions, calls] = await Promise.all([
        store.listMessages(conv.id),
        store.listActions(conv.id),
        store.listCalls(conv.id),
      ]);
      const t = now();
      const horario = deps.settings().horarioLlamadas;

      // Las tarjetas se crean a media vuelta pero se muestran al final de su turno:
      // antes del siguiente mensaje del usuario o nota del sistema (confirmar,
      // cancelar, llamada), que siempre se guardan después de la vuelta.
      const boundaries = messages
        .filter((m) => m.message.role === 'user' || (m.message.role === 'assistant' && m.message.raw?.proveedor === 'sistema'))
        .map((m) => m.createdAt.getTime());
      const turnEnd = (at: Date) => {
        const next = boundaries.find((u) => u > at.getTime());
        return next === undefined ? Number.MAX_SAFE_INTEGER : next - 0.5;
      };

      const keyed: { key: number; seq: number; item: ConversationItem }[] = [];
      let seq = 0;
      for (const m of messages as MessageRow[]) {
        const msg = m.message;
        if (msg.role === 'tool' || isHidden(msg)) continue;
        if (msg.role === 'assistant' && !msg.content.trim()) continue;
        keyed.push({
          key: m.createdAt.getTime(),
          seq: seq++,
          item: { tipo: 'mensaje', id: m.id, rol: msg.role, texto: msg.content, fecha: m.createdAt.toISOString() },
        });
      }
      for (const a of actions) {
        if (a.status === 'pendiente' && a.expiresAt.getTime() <= t.getTime()) void store.expireAction(a.id).catch(() => {});
        keyed.push({ key: turnEnd(a.createdAt), seq: seq++, item: { tipo: 'accion', ...actionView(a, t) } });
      }
      for (const c of calls) {
        keyed.push({ key: turnEnd(c.createdAt), seq: seq++, item: { tipo: 'llamada', ...callView(c, horario) } });
      }
      keyed.sort((x, y) => x.key - y.key || x.seq - y.seq);
      return { items: keyed.map((k) => k.item) };
    },

    async mensaje(req: RequestInfo, body: unknown): Promise<MessageResponse> {
      const st = deps.ai();
      if (!st.configured) return { estado: 'inactivo', texto: '', acciones: [] };

      const parsed = parseMessageInput(body);
      if (!parsed.ok) return { estado: 'invalido', texto: parsed.error, acciones: [] };
      const input = parsed.value;
      const settings = deps.settings();
      const { auth } = req;

      const used = await store.countUserMessagesSince(auth.riferoId, new Date(now().getTime() - 24 * 60 * 60_000));
      if (used >= settings.limiteDiario) return { estado: 'limite', texto: LIMIT_TEXT, acciones: [], permitirLlamada: true };

      const conv = await activeConversation(auth, input.timeZone);
      const history = await store.listMessages(conv.id);

      // Se guarda el mensaje del usuario (sin imágenes). Al reintentar no se duplica.
      const stored: UserMessage = { role: 'user', content: storedUserContent(input.texto, input.imagenes.length) };
      const last = history[history.length - 1]?.message;
      const isRetry = input.reintentar && last?.role === 'user' && last.content === stored.content;
      const previous = isRetry ? history.slice(0, -1) : history;
      if (!isRetry) await store.addMessage(conv.id, stored);

      // Para la IA, el mensaje actual sí lleva las imágenes.
      const live: UserMessage = { role: 'user', content: input.texto, ...(input.imagenes.length ? { images: input.imagenes } : {}) };
      const aiHistory: NeutralMessage[] = [...previous.map((m) => m.message), live];

      const created: ToolContext['created'] = { actions: [], call: null };
      let acc: Account | null = null;
      try {
        // La cuenta va primero: si la IA está mal configurada, la alerta dice de qué cliente es.
        acc = await loadAccount(auth);
        if (st.error) throw st.error;
        const client = st.client!;
        const raffles = await store.listRecentRaffles(auth.riferoId, { onlyPublic: !acc.isAdmin, take: 8 });
        const system = buildSystemPrompt(
          { MARCA: settings.marca, NOTA_IMAGENES: client.config.vision ? '' : NOTA_SIN_IMAGENES, HORARIO_LLAMADAS: settings.horarioLlamadas },
          buildContextVars(acc, raffles, { siteUrl: req.siteUrl, timeZone: input.timeZone, now: now() }),
        );

        const ctx: ToolContext = {
          auth,
          isAdmin: acc.isAdmin,
          api: req.api,
          store,
          notifier: deps.notifier,
          log,
          conversationId: conv.id,
          timeZone: input.timeZone,
          currency: acc.profile.currency,
          siteUrl: req.siteUrl,
          marca: settings.marca,
          horario: settings.horarioLlamadas,
          sellerCode: acc.user.sellerCode,
          client: clientInfo(acc, req.siteUrl),
          now,
          created,
        };

        const result = await runAgent({
          client,
          system,
          history: aiHistory,
          tools: toolsForRole(acc.isAdmin),
          execTool: (call) => runTool(ctx, call),
          emptyFallback: () => (created.actions.length ? REVIEW_CARD_TEXT : EMPTY_REPLY),
        });
        for (const m of result.nuevos) {
          await store.addMessage(conv.id, m.message, m.uso ? { in: m.uso.entrada, out: m.uso.salida } : undefined);
        }
        return {
          estado: 'ok',
          texto: result.texto,
          acciones: created.actions.map((a) => actionView(a, now())),
          ...(created.call ? { llamada: created.call } : {}),
          ...(result.pasosAgotados ? { permitirLlamada: true } : {}),
        };
      } catch (err) {
        let aiErr: AiError;
        if (err instanceof AgentError) {
          for (const m of err.parcial) await store.addMessage(conv.id, m.message).catch(() => {});
          aiErr = err.cause;
        } else if (err instanceof AiError) {
          aiErr = err;
        } else {
          log.error({ err: (err as Error)?.message, stack: (err as Error)?.stack }, 'Asistente: error inesperado');
          aiErr = new AiError('proveedor', (err as Error)?.message ?? 'error');
        }
        log.error({ tipo: aiErr.tipo, status: aiErr.status, detalle: aiErr.message }, 'Asistente: la IA no pudo responder');
        alertAiDown(aiErr, acc, req.siteUrl);
        return {
          estado: 'error',
          texto: AI_DOWN_TEXT,
          acciones: created.actions.map((a) => actionView(a, now())),
          ...(created.call ? { llamada: created.call } : {}),
          permitirLlamada: true,
        };
      }
    },

    async confirmar(req: RequestInfo, actionId: string, body: unknown) {
      const { auth } = req;
      const action = await store.getAction(actionId);
      // Acción ajena = no existe (no se revela nada).
      if (!action || action.userId !== auth.userId) throw new AssistantHttpError(404, 'No encontré esa acción.');

      const claimed = await store.claimAction(actionId, auth.userId, now());
      if (!claimed) {
        const current = (await store.getAction(actionId))!;
        if (current.status === 'pendiente' && current.expiresAt.getTime() <= now().getTime()) {
          await store.expireAction(actionId);
          return { estado: 'expirada' as ActionStatus, texto: EXPIRED_TEXT, accion: actionView({ ...current, status: 'expirada' }, now()) };
        }
        // Ya se procesó (doble toque o en otra pestaña): se informa su estado.
        return { estado: current.status, texto: current.result?.mensaje ?? '', accion: actionView(current, now()) };
      }

      const finish = async (status: 'hecha' | 'fallida', result: ActionResult) => {
        await store.finishAction(actionId, status, result);
        const link = result.enlace ? ` [${result.enlace.texto}](${result.enlace.url})` : '';
        const note = status === 'hecha' ? `${result.mensaje}${link}` : `No se pudo hacer «${action.card.titulo}»: ${result.mensaje}`;
        await store.addMessage(action.conversationId, systemNote(note, actionId, true));
        const fresh = (await store.getAction(actionId)) ?? { ...action, status, result };
        return { estado: status as ActionStatus, texto: result.mensaje, accion: actionView(fresh, now()) };
      };

      // Se vuelve a revisar el rol (en la BD, no solo en el JWT).
      const user = await store.getUser(auth.userId);
      const allowed =
        !!user &&
        user.status === 'ACTIVE' &&
        isAdminRole(user.role) &&
        isAdminRole(auth.role) &&
        user.riferoId === action.riferoId &&
        auth.riferoId === action.riferoId;
      if (!allowed) return finish('fallida', { ok: false, mensaje: 'Tu usuario no tiene permiso para hacer cambios en esta cuenta.' });

      const tool = WRITE_TOOLS[action.tool];
      if (!tool) return finish('fallida', { ok: false, mensaje: 'No reconozco esta acción.' });

      const profile = await store.getProfile(auth.riferoId);
      const tz = safeTimeZone((body as { zonaHoraria?: unknown } | null)?.zonaHoraria);
      try {
        const result = await tool.execute(
          { api: req.api, timeZone: tz, currency: profile?.currency ?? 'MXN', siteUrl: req.siteUrl, now },
          action.args,
        );
        if (action.card.whatsapp && !result.whatsapp) result.whatsapp = action.card.whatsapp;
        return finish('hecha', result);
      } catch (err) {
        let message = TECHNICAL_ERROR;
        if (err instanceof ApiCallError && !err.technical) message = err.message;
        else log.error({ tool: action.tool, err: (err as Error)?.message, detail: (err as ApiCallError)?.detail }, 'Asistente: falló una acción confirmada');
        return finish('fallida', { ok: false, mensaje: message });
      }
    },

    async cancelar(auth: SessionAuth, actionId: string) {
      const action = await store.getAction(actionId);
      if (!action || action.userId !== auth.userId) throw new AssistantHttpError(404, 'No encontré esa acción.');
      const ok = await store.cancelAction(actionId, auth.userId);
      if (!ok) {
        const current = (await store.getAction(actionId))!;
        return { estado: actionView(current, now()).estado, texto: '', accion: actionView(current, now()) };
      }
      await store.addMessage(action.conversationId, systemNote(CANCEL_TEXT, actionId, false));
      const fresh = (await store.getAction(actionId))!;
      return { estado: 'cancelada' as ActionStatus, texto: CANCEL_TEXT, accion: actionView(fresh, now()) };
    },

    // «Pedir llamada»: funciona SIN IA (el chat promete atención 24 h).
    async llamada(req: RequestInfo, body: unknown) {
      const { auth } = req;
      const b = (body ?? {}) as { telefono?: unknown; motivo?: unknown; zonaHoraria?: unknown };
      const acc = await loadAccount(auth);
      const phoneRaw = typeof b.telefono === 'string' && b.telefono.trim() ? b.telefono : defaultPhone(acc);
      const phone = validatePhone(phoneRaw ?? '');
      if (!phone.ok) throw new AssistantHttpError(400, phone.error);
      const motivo =
        typeof b.motivo === 'string' && b.motivo.trim()
          ? b.motivo.trim().slice(0, 500)
          : 'Pidió una llamada desde el chat (botón «Pedir llamada»).';
      const settings = deps.settings();
      const conv = await activeConversation(auth, safeTimeZone(b.zonaHoraria));
      const created: { call: CallView | null } = { call: null };
      const res = await scheduleCall(
        {
          auth,
          store,
          notifier: deps.notifier,
          log,
          conversationId: conv.id,
          marca: settings.marca,
          horario: settings.horarioLlamadas,
          client: clientInfo(acc, req.siteUrl),
          now,
          created,
        },
        { phone: phone.value, reason: motivo, urgency: 'alta', attempted: null },
      );
      if (!res.duplicate) {
        await store.addMessage(
          conv.id,
          systemNote(`📞 Se agendó una llamada al ${res.view.telefono}: el equipo le llama lo antes posible.`, null, true),
        );
      }
      return { ok: true, duplicada: res.duplicate, llamada: res.view };
    },

    async nueva(auth: SessionAuth) {
      const ids = await store.deactivateConversations(auth.userId);
      await store.expirePendingActions(ids);
      return { ok: true };
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;

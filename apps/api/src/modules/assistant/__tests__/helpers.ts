// Utilidades de prueba: store en memoria, cliente de IA falso y API falsa.
import type { AiClient } from '../ai/client.js';
import type { AiConfig, ChatInput, ChatResult, ToolCall } from '../ai/types.js';
import type { ApiCaller, ApiResponse } from '../api.js';
import type { Notifier, TeamAlert } from '../notify.js';
import type { AssistantSettings } from '../settings.js';
import type {
  ActionRow,
  AssistantStore,
  CallRow,
  ConversationRow,
  MessageRow,
  ProfileInfo,
  RaffleLine,
  UserInfo,
} from '../store.js';

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

export interface MemoryStore extends AssistantStore {
  conversations: (ConversationRow & { active: boolean })[];
  messages: (MessageRow & { conversationId: string; riferoId: string })[];
  actions: ActionRow[];
  calls: CallRow[];
  reports: { userId: string; riferoId: string; type: string; description: string }[];
  users: Map<string, UserInfo>;
  profiles: Map<string, ProfileInfo>;
  raffles: RaffleLine[];
}

export function memoryStore(clock: () => Date = () => new Date()): MemoryStore {
  const s: MemoryStore = {
    conversations: [],
    messages: [],
    actions: [],
    calls: [],
    reports: [],
    users: new Map(),
    profiles: new Map(),
    raffles: [],

    async findActiveConversation(userId) {
      const c = [...s.conversations].reverse().find((x) => x.userId === userId && x.active);
      return c ? { id: c.id, userId: c.userId, riferoId: c.riferoId, timeZone: c.timeZone } : null;
    },
    async createConversation(data) {
      const c = { id: id('conv'), active: true, ...data };
      s.conversations.push(c);
      return { id: c.id, userId: c.userId, riferoId: c.riferoId, timeZone: c.timeZone };
    },
    async setConversationTimeZone(cid, tz) {
      const c = s.conversations.find((x) => x.id === cid);
      if (c) c.timeZone = tz;
    },
    async deactivateConversations(userId) {
      const ids: string[] = [];
      for (const c of s.conversations) if (c.userId === userId && c.active) {
        c.active = false;
        ids.push(c.id);
      }
      return ids;
    },
    async listMessages(conversationId) {
      return s.messages.filter((m) => m.conversationId === conversationId).map(({ id: mid, message, createdAt }) => ({ id: mid, message, createdAt }));
    },
    async addMessage(conversationId, message) {
      const conv = s.conversations.find((c) => c.id === conversationId)!;
      // Reloj estrictamente creciente para que el orden sea determinista.
      const last = s.messages[s.messages.length - 1]?.createdAt.getTime() ?? 0;
      const at = new Date(Math.max(clock().getTime(), last + 1));
      const row = { id: id('msg'), message, createdAt: at, conversationId, riferoId: conv.riferoId };
      s.messages.push(row);
      return { id: row.id, message, createdAt: at };
    },
    async countUserMessagesSince(riferoId, since) {
      return s.messages.filter((m) => m.riferoId === riferoId && m.message.role === 'user' && m.createdAt >= since).length;
    },
    async createAction(data) {
      const row: ActionRow = { ...data, id: id('act'), status: 'pendiente', result: null, createdAt: clock() };
      s.actions.push(row);
      return { ...row };
    },
    async claimAction(aid, userId, now) {
      const a = s.actions.find((x) => x.id === aid);
      if (!a || a.userId !== userId || a.status !== 'pendiente' || a.expiresAt <= now) return false;
      a.status = 'ejecutando';
      return true;
    },
    async getAction(aid) {
      const a = s.actions.find((x) => x.id === aid);
      return a ? { ...a } : null;
    },
    async finishAction(aid, status, result) {
      const a = s.actions.find((x) => x.id === aid)!;
      a.status = status;
      a.result = result;
    },
    async cancelAction(aid, userId) {
      const a = s.actions.find((x) => x.id === aid);
      if (!a || a.userId !== userId || a.status !== 'pendiente') return false;
      a.status = 'cancelada';
      return true;
    },
    async expireAction(aid) {
      const a = s.actions.find((x) => x.id === aid);
      if (!a || a.status !== 'pendiente') return false;
      a.status = 'expirada';
      return true;
    },
    async expirePendingActions(ids) {
      for (const a of s.actions) if (ids.includes(a.conversationId) && a.status === 'pendiente') a.status = 'expirada';
    },
    async listActions(conversationId) {
      return s.actions.filter((a) => a.conversationId === conversationId).map((a) => ({ ...a }));
    },
    async createCall(data) {
      const row: CallRow = { ...data, id: id('call'), status: 'nueva', createdAt: clock() };
      s.calls.push(row);
      return row;
    },
    async findRecentCall(userId, since) {
      return [...s.calls].reverse().find((c) => c.userId === userId && c.status === 'nueva' && c.createdAt >= since) ?? null;
    },
    async listCalls(conversationId) {
      return s.calls.filter((c) => c.conversationId === conversationId);
    },
    async createReport(data) {
      s.reports.push(data);
    },
    async getUser(uid) {
      return s.users.get(uid) ?? null;
    },
    async getProfile(rid) {
      return s.profiles.get(rid) ?? null;
    },
    async listRecentRaffles(riferoId, opts) {
      return s.raffles.filter((r) => !opts.onlyPublic || (['PUBLISHED', 'FINISHED'].includes(r.status) && !r.hidden)).slice(0, opts.take);
    },
  };
  return s;
}

// Cuenta de ejemplo: un dueño (admin), un vendedor y la página.
export function seedAccount(s: MemoryStore) {
  s.profiles.set('rif1', {
    id: 'rif1',
    publicName: 'Rifas Ana',
    slug: 'rifas-ana',
    whatsapp: '6621234567',
    currency: 'MXN',
    locale: 'es',
    paymentBanks: [],
  });
  s.users.set('admin1', { id: 'admin1', name: 'Ana', phone: '6621234567', role: 'RIFERO', status: 'ACTIVE', sellerCode: null, riferoId: 'rif1' });
  s.users.set('seller1', { id: 'seller1', name: 'Beto', phone: '6629998877', role: 'SELLER', status: 'ACTIVE', sellerCode: 'VEN01', riferoId: 'rif1' });
  s.users.set('admin2', { id: 'admin2', name: 'Otro', phone: null, role: 'RIFERO', status: 'ACTIVE', sellerCode: null, riferoId: 'rif2' });
}

export const ADMIN = { userId: 'admin1', role: 'RIFERO' as const, riferoId: 'rif1' };
export const SELLER = { userId: 'seller1', role: 'SELLER' as const, riferoId: 'rif1' };

// ── IA falsa ────────────────────────────────────────────────────────
export function text(t: string): ChatResult {
  return { texto: t, llamadas: [], fin: 'stop', uso: { entrada: 10, salida: 5 }, mensaje: { role: 'assistant', content: t } };
}

export function calls(...list: { name: string; args?: Record<string, unknown>; invalidArgs?: string }[]): ChatResult {
  const llamadas: ToolCall[] = list.map((c, i) => ({ id: `call_${++seq}_${i}`, name: c.name, args: c.args ?? {}, ...(c.invalidArgs !== undefined ? { invalidArgs: c.invalidArgs } : {}) }));
  return { texto: '', llamadas, fin: 'tool_calls', uso: { entrada: 10, salida: 5 }, mensaje: { role: 'assistant', content: '', toolCalls: llamadas } };
}

export const FAKE_CONFIG: AiConfig = {
  provider: 'openai',
  format: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-test',
  baseUrl: 'https://example.invalid/v1',
  vision: true,
  maxTokens: 2048,
  timeoutMs: 1000,
  appName: 'Riffast',
};

export function fakeAi(script: (ChatResult | Error | ((input: ChatInput) => ChatResult))[]): AiClient & { inputs: ChatInput[] } {
  const inputs: ChatInput[] = [];
  let i = 0;
  return {
    config: FAKE_CONFIG,
    inputs,
    async chat(input) {
      inputs.push(JSON.parse(JSON.stringify(input)));
      const step = script[Math.min(i++, script.length - 1)];
      if (step instanceof Error) throw step;
      return typeof step === 'function' ? step(input) : step;
    },
  };
}

// ── API falsa (lo que contestaría app.inject) ───────────────────────
export interface ApiCall {
  method: string;
  path: string;
  body?: unknown;
}

export function fakeApi(routes: Record<string, (body?: unknown) => ApiResponse>): ApiCaller & { calls: ApiCall[] } {
  const callsMade: ApiCall[] = [];
  const fn = (async (method, path, body) => {
    callsMade.push({ method, path, body });
    const key = `${method} ${path.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) return { status: 404, body: { error: 'not_found', message: `Ruta no encontrada: ${key}` } };
    return handler(body);
  }) as ApiCaller & { calls: ApiCall[] };
  fn.calls = callsMade;
  return fn;
}

export function recordingNotifier(): Notifier & { sent: TeamAlert[] } {
  const sent: TeamAlert[] = [];
  return {
    sent,
    async send(alert) {
      sent.push(alert);
    },
  };
}

export const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

export function testSettings(over: Partial<AssistantSettings> = {}): AssistantSettings {
  return {
    marca: 'Riffast',
    horarioLlamadas: 'de 9:00 a 21:00, hora del centro de México',
    limiteDiario: 150,
    telegramToken: '',
    telegramChatId: '',
    webhookUrl: '',
    siteUrl: '',
    ...over,
  };
}

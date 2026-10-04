// Persistencia del asistente detrás de una interfaz (Prisma en producción, en
// memoria en las pruebas).
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getRaffleStats } from '../../lib/stats.js';
import { riferoPaymentMethods } from '../../lib/serializers.js';
import type { NeutralMessage } from './ai/types.js';
import type { ActionResult, ActionStatus, Card } from './types.js';

export interface ConversationRow {
  id: string;
  userId: string;
  riferoId: string;
  timeZone: string | null;
}

export interface MessageRow {
  id: string;
  message: NeutralMessage;
  createdAt: Date;
}

export interface ActionRow {
  id: string;
  userId: string;
  riferoId: string;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  card: Card;
  status: ActionStatus;
  expiresAt: Date;
  result: ActionResult | null;
  createdAt: Date;
}

export interface CallRow {
  id: string;
  userId: string;
  riferoId: string;
  conversationId: string | null;
  phone: string;
  reason: string;
  urgency: string;
  attempted: string | null;
  status: string;
  createdAt: Date;
}

export interface UserInfo {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  sellerCode: string | null;
  riferoId: string | null; // dueño: su perfil; staff: su membresía
}

export interface ProfileInfo {
  id: string;
  publicName: string;
  slug: string;
  whatsapp: string | null;
  currency: 'MXN' | 'USD';
  locale: 'es' | 'en';
  paymentBanks: string[];
}

export interface RaffleLine {
  id: string;
  eventNumber: number;
  title: string;
  status: string;
  hidden: boolean;
  soldCount: number;
  totalTickets: number;
  ticketPrice: number;
  drawDate: Date | null;
}

export interface AssistantStore {
  findActiveConversation(userId: string): Promise<ConversationRow | null>;
  createConversation(data: { userId: string; riferoId: string; timeZone: string }): Promise<ConversationRow>;
  setConversationTimeZone(id: string, timeZone: string): Promise<void>;
  deactivateConversations(userId: string): Promise<string[]>;

  listMessages(conversationId: string): Promise<MessageRow[]>;
  addMessage(conversationId: string, message: NeutralMessage, tokens?: { in: number; out: number }): Promise<MessageRow>;
  countUserMessagesSince(riferoId: string, since: Date): Promise<number>;

  createAction(data: Omit<ActionRow, 'id' | 'status' | 'result' | 'createdAt'>): Promise<ActionRow>;
  // Atómico: pendiente → ejecutando solo si es del usuario y no ha expirado.
  claimAction(id: string, userId: string, now: Date): Promise<boolean>;
  getAction(id: string): Promise<ActionRow | null>;
  finishAction(id: string, status: 'hecha' | 'fallida', result: ActionResult): Promise<void>;
  // pendiente → cancelada (solo del usuario).
  cancelAction(id: string, userId: string): Promise<boolean>;
  // pendiente → expirada.
  expireAction(id: string): Promise<boolean>;
  expirePendingActions(conversationIds: string[]): Promise<void>;
  listActions(conversationId: string): Promise<ActionRow[]>;

  createCall(data: Omit<CallRow, 'id' | 'status' | 'createdAt'>): Promise<CallRow>;
  findRecentCall(userId: string, since: Date): Promise<CallRow | null>;
  listCalls(conversationId: string): Promise<CallRow[]>;
  createReport(data: { userId: string; riferoId: string; type: string; description: string }): Promise<void>;

  // Lecturas de la cuenta para el contexto (solo presentación).
  getUser(userId: string): Promise<UserInfo | null>;
  getProfile(riferoId: string): Promise<ProfileInfo | null>;
  listRecentRaffles(riferoId: string, opts: { onlyPublic: boolean; take: number }): Promise<RaffleLine[]>;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

function toAction(r: {
  id: string;
  userId: string;
  riferoId: string;
  conversationId: string;
  tool: string;
  args: Prisma.JsonValue;
  card: Prisma.JsonValue;
  status: string;
  expiresAt: Date;
  result: Prisma.JsonValue | null;
  createdAt: Date;
}): ActionRow {
  return {
    id: r.id,
    userId: r.userId,
    riferoId: r.riferoId,
    conversationId: r.conversationId,
    tool: r.tool,
    args: (r.args ?? {}) as Record<string, unknown>,
    card: r.card as unknown as Card,
    status: r.status as ActionStatus,
    expiresAt: r.expiresAt,
    result: (r.result ?? null) as unknown as ActionResult | null,
    createdAt: r.createdAt,
  };
}

export const prismaStore: AssistantStore = {
  async findActiveConversation(userId) {
    return prisma.assistantConversation.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, riferoId: true, timeZone: true },
    });
  },
  async createConversation(data) {
    return prisma.assistantConversation.create({
      data,
      select: { id: true, userId: true, riferoId: true, timeZone: true },
    });
  },
  async setConversationTimeZone(id, timeZone) {
    await prisma.assistantConversation.update({ where: { id }, data: { timeZone } });
  },
  async deactivateConversations(userId) {
    const rows = await prisma.assistantConversation.findMany({ where: { userId, active: true }, select: { id: true } });
    await prisma.assistantConversation.updateMany({ where: { userId, active: true }, data: { active: false } });
    return rows.map((r) => r.id);
  },

  async listMessages(conversationId) {
    const rows = await prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, message: r.message as unknown as NeutralMessage, createdAt: r.createdAt }));
  },
  async addMessage(conversationId, message, tokens) {
    const r = await prisma.assistantMessage.create({
      data: {
        conversationId,
        role: message.role,
        message: json(message),
        tokensIn: tokens?.in ?? null,
        tokensOut: tokens?.out ?? null,
      },
    });
    await prisma.assistantConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return { id: r.id, message, createdAt: r.createdAt };
  },
  async countUserMessagesSince(riferoId, since) {
    return prisma.assistantMessage.count({ where: { role: 'user', createdAt: { gte: since }, conversation: { riferoId } } });
  },

  async createAction(data) {
    const r = await prisma.assistantAction.create({
      data: { ...data, args: json(data.args), card: json(data.card), status: 'pendiente' },
    });
    return toAction(r);
  },
  async claimAction(id, userId, now) {
    const res = await prisma.assistantAction.updateMany({
      where: { id, userId, status: 'pendiente', expiresAt: { gt: now } },
      data: { status: 'ejecutando' },
    });
    return res.count === 1;
  },
  async getAction(id) {
    const r = await prisma.assistantAction.findUnique({ where: { id } });
    return r ? toAction(r) : null;
  },
  async finishAction(id, status, result) {
    await prisma.assistantAction.update({ where: { id }, data: { status, result: json(result) } });
  },
  async cancelAction(id, userId) {
    const res = await prisma.assistantAction.updateMany({ where: { id, userId, status: 'pendiente' }, data: { status: 'cancelada' } });
    return res.count === 1;
  },
  async expireAction(id) {
    const res = await prisma.assistantAction.updateMany({ where: { id, status: 'pendiente' }, data: { status: 'expirada' } });
    return res.count === 1;
  },
  async expirePendingActions(conversationIds) {
    if (!conversationIds.length) return;
    await prisma.assistantAction.updateMany({
      where: { conversationId: { in: conversationIds }, status: 'pendiente' },
      data: { status: 'expirada' },
    });
  },
  async listActions(conversationId) {
    const rows = await prisma.assistantAction.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toAction);
  },

  async createCall(data) {
    return prisma.assistantCall.create({ data });
  },
  async findRecentCall(userId, since) {
    return prisma.assistantCall.findFirst({
      where: { userId, status: 'nueva', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  },
  async listCalls(conversationId) {
    return prisma.assistantCall.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  },
  async createReport(data) {
    await prisma.assistantReport.create({ data });
  },

  async getUser(userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { riferoProfile: { select: { id: true } } } });
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      phone: u.phone ?? null,
      role: u.role,
      status: u.status,
      sellerCode: u.sellerCode ?? null,
      riferoId: u.riferoProfile?.id ?? u.memberOfRiferoId ?? null,
    };
  },
  async getProfile(riferoId) {
    const p = await prisma.riferoProfile.findUnique({ where: { id: riferoId } });
    if (!p) return null;
    return {
      id: p.id,
      publicName: p.publicName,
      slug: p.slug,
      whatsapp: p.whatsapp ?? null,
      currency: p.currency === 'USD' ? 'USD' : 'MXN',
      locale: p.locale === 'en' ? 'en' : 'es',
      paymentBanks: riferoPaymentMethods(p).map((m) => m.bank),
    };
  },
  async listRecentRaffles(riferoId, opts) {
    const rows = await prisma.raffle.findMany({
      where: {
        riferoId,
        ...(opts.onlyPublic ? { status: { in: ['PUBLISHED', 'FINISHED'] }, hidden: false } : {}),
      },
      orderBy: { eventNumber: 'desc' },
      take: opts.take,
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        eventNumber: r.eventNumber,
        title: r.title,
        status: r.status,
        hidden: r.hidden,
        soldCount: (await getRaffleStats(r.id, r.totalTickets)).soldCount,
        totalTickets: r.totalTickets,
        ticketPrice: r.ticketPrice,
        drawDate: r.drawDate,
      })),
    );
  },
};

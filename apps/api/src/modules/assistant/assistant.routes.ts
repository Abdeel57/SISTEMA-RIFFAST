// Rutas de «Asistencia 24 h» bajo /api/asistente. Mismo middleware de sesión
// del panel (requireStaff: administradores y vendedores de la cuenta).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { isAllowedOrigin } from '../../lib/origins.js';
import { requireStaff } from '../../middlewares/auth.js';
import { describeAiStatus, getAiStatus } from './ai/client.js';
import { injectCaller } from './api.js';
import { createNotifier } from './notify.js';
import { AssistantHttpError, createAssistantService, type RequestInfo } from './service.js';
import { assistantSettings } from './settings.js';
import { prismaStore } from './store.js';
import type { SessionAuth } from './types.js';

// Las fotos viajan en base64 (hasta 2, ya comprimidas en el navegador): el
// límite de body sube SOLO en esta ruta.
const MESSAGE_BODY_LIMIT = 6 * 1024 * 1024;

function sessionAuth(request: FastifyRequest): SessionAuth {
  const a = request.auth!;
  return { userId: a.userId, role: a.role, riferoId: a.riferoId! };
}

// URL pública del sitio: PUBLIC_WEB_URL o el origen desde donde abrieron el panel.
function siteUrl(request: FastifyRequest): string {
  if (env.publicWebUrl) return env.publicWebUrl;
  const self = `${request.protocol}://${request.hostname}`;
  const candidates = [request.headers.origin, request.headers.referer];
  for (const c of candidates) {
    if (typeof c !== 'string' || !c) continue;
    try {
      const origin = new URL(c).origin;
      if (origin === self || isAllowedOrigin(origin)) return origin;
    } catch {
      /* siguiente */
    }
  }
  return self;
}

function toAppError(err: unknown): unknown {
  if (err instanceof AssistantHttpError) {
    const code = err.statusCode === 404 ? 'not_found' : err.statusCode === 403 ? 'forbidden' : 'bad_request';
    return new AppError(err.statusCode, code, err.message);
  }
  return err;
}

export default async function assistantRoutes(app: FastifyInstance): Promise<void> {
  const settings = () => assistantSettings();
  const service = createAssistantService({
    store: prismaStore,
    ai: getAiStatus,
    notifier: createNotifier(settings, app.log),
    settings,
    log: app.log,
  });

  // Al arrancar: proveedor, modelo y si lee imágenes (nunca la clave).
  app.log.info(describeAiStatus());
  const s = settings();
  if (getAiStatus().configured && !(s.telegramToken && s.telegramChatId) && !s.webhookUrl) {
    app.log.warn('Asistencia 24 h: sin canal de avisos al equipo (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID o ASISTENTE_WEBHOOK_URL). Las llamadas quedarán solo en logs y BD.');
  }

  const info = (request: FastifyRequest): RequestInfo => ({
    auth: sessionAuth(request),
    api: injectCaller(app, request),
    siteUrl: siteUrl(request),
  });

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw toAppError(err);
    }
  };

  app.get('/asistente/estado', { preHandler: requireStaff }, async (request) => run(() => service.estado(sessionAuth(request))));

  app.get('/asistente/conversacion', { preHandler: requireStaff }, async (request) =>
    run(() => service.conversacion(sessionAuth(request))),
  );

  app.post(
    '/asistente/mensaje',
    {
      preHandler: requireStaff,
      bodyLimit: MESSAGE_BODY_LIMIT,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request) => run(() => service.mensaje(info(request), request.body)),
  );

  app.post('/asistente/acciones/:id/confirmar', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    return run(() => service.confirmar(info(request), id, request.body));
  });

  app.post('/asistente/acciones/:id/cancelar', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    return run(() => service.cancelar(sessionAuth(request), id));
  });

  app.post(
    '/asistente/llamada',
    { preHandler: requireStaff, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => run(() => service.llamada(info(request), request.body)),
  );

  app.post('/asistente/nueva', { preHandler: requireStaff }, async (request) => run(() => service.nueva(sessionAuth(request))));
}

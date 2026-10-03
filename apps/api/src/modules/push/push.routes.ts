import type { FastifyInstance } from 'fastify';
import { requireRifero } from '../../middlewares/auth.js';
import { badRequest } from '../../lib/errors.js';
import { vapidPublicKey, saveSubscription, removeSubscription } from '../../lib/push.js';

export default async function pushRoutes(app: FastifyInstance): Promise<void> {
  // GET /push/public-key — clave pública VAPID para suscribir en el cliente.
  app.get('/push/public-key', async () => ({ key: vapidPublicKey() }));

  // POST /push/subscribe — registra el dispositivo del rifero (solo organizadores).
  app.post('/push/subscribe', { preHandler: requireRifero }, async (request, reply) => {
    const body = request.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      throw badRequest('Suscripción de push inválida');
    }
    await saveSubscription(
      request.auth!.userId,
      { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } },
      request.headers['user-agent'],
    );
    return reply.code(201).send({ ok: true });
  });

  // POST /push/unsubscribe — baja el dispositivo.
  app.post('/push/unsubscribe', { preHandler: requireRifero }, async (request, reply) => {
    const { endpoint } = request.body as { endpoint?: string };
    if (endpoint) await removeSubscription(endpoint);
    return reply.send({ ok: true });
  });
}

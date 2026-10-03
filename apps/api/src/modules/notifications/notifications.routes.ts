import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireRifero } from '../../middlewares/auth.js';

export default async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications/summary — contadores para el badge del panel del rifero.
  // pendingOrders: órdenes apartadas/por confirmar. pendingProofs: comprobantes por revisar.
  app.get('/notifications/summary', { preHandler: requireRifero }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const [pendingOrders, pendingProofs] = await Promise.all([
      prisma.order.count({
        where: { raffle: { riferoId }, status: { in: ['RESERVED', 'PENDING'] } },
      }),
      prisma.paymentProof.count({
        where: { status: 'PENDING', order: { raffle: { riferoId } } },
      }),
    ]);
    return { pendingOrders, pendingProofs, total: pendingOrders + pendingProofs };
  });
}

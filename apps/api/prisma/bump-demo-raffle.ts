// Script de mantenimiento (demo): pone una descripción/promo profesional en la
// rifa e2 del rifero demo y sube su cantidad de boletos a 9,999 (regenerándolos).
// Uso:  npx tsx prisma/bump-demo-raffle.ts
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { formatTicketNumber } from './seed-helpers.js';

const prisma = new PrismaClient();

const SLUG = 'rifasdelasuerte';
const EVENT = 2;
const TOTAL = 9999;
const FORMAT = 4; // 0001 .. 9999

// Cartel con texto enriquecido (lo mismo que produce el mini editor del admin).
const DESCRIPTION = [
  '<div style="font-weight:800;font-size:large;">CON TU BOLETO <span style="color:#16a34a;">LIQUIDADO</span> PARTICIPAS POR:</div>',
  '<div style="font-weight:800;font-size:x-large;color:#16a34a;">🛻 CAMIONETA 2024 · TOYOTA HILUX</div>',
  '<div style="font-weight:800;">+ $30,000 MXN EN EFECTIVO</div>',
  '<div><br></div>',
  '<div style="font-weight:700;">DEL 2DO AL 10MO LUGAR</div>',
  '<div style="font-weight:800;color:#16a34a;font-size:large;">$5,000 MXN CADA UNO</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#dc2626;">🔥 BONO PRONTO PAGO</div>',
  '<div>te llevas <span style="font-weight:800;color:#16a34a;">$30,000 MXN</span> extra si liquidas</div>',
  '<div>tu boleto antes de 12 hrs de apartado</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#7c3aed;">💎 BONO EXÓTICO $100,000 MXN</div>',
  '<div>comprando más de 10 boletos en una sola exhibición</div>',
  '<div style="font-weight:700;">¡NO DESPRECIES TUS BOLETOS!</div>',
].join('');

async function main() {
  const profile = await prisma.riferoProfile.findUnique({ where: { slug: SLUG } });
  if (!profile) throw new Error(`Rifero "${SLUG}" no encontrado`);

  const raffle = await prisma.raffle.findFirst({ where: { riferoId: profile.id, eventNumber: EVENT } });
  if (!raffle) throw new Error(`Rifa e${EVENT} no encontrada`);

  // Limpiar dependientes y boletos previos (la demo no tiene ventas).
  await prisma.winner.deleteMany({ where: { raffleId: raffle.id } });
  const orders = await prisma.order.findMany({ where: { raffleId: raffle.id }, select: { id: true } });
  if (orders.length) {
    await prisma.orderTicket.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.order.deleteMany({ where: { raffleId: raffle.id } });
  }
  await prisma.ticketNumber.deleteMany({ where: { raffleId: raffle.id } });

  // Actualizar la rifa: promo + cantidad de boletos.
  await prisma.raffle.update({
    where: { id: raffle.id },
    data: {
      description: DESCRIPTION,
      totalTickets: TOTAL,
      ticketFormat: FORMAT,
      ticketStart: 1,
      ticketEnd: TOTAL,
    },
  });

  // Regenerar boletos disponibles en lotes.
  const all = Array.from({ length: TOTAL }, (_, i) => ({
    raffleId: raffle.id,
    number: i + 1,
    displayNumber: formatTicketNumber(i + 1, FORMAT),
  }));
  const BATCH = 2000;
  for (let s = 0; s < all.length; s += BATCH) {
    await prisma.ticketNumber.createMany({ data: all.slice(s, s + BATCH) });
  }

  console.log(`OK · "${raffle.title}" (e${EVENT}) → ${TOTAL} boletos disponibles, formato ${FORMAT}, promo aplicada.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

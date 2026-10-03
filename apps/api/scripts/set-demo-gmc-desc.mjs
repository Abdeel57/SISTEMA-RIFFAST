// One-off: actualiza la descripción de la rifa demo E2 acorde al premio GMC.
//   node scripts/set-demo-gmc-desc.mjs
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const SLUG = 'rifasdelasuerte';
const EVENT = 2;

const DESCRIPTION = [
  '<div style="font-weight:800;font-size:large;">CON TU BOLETO <span style="color:#16a34a;">LIQUIDADO</span> PARTICIPAS POR:</div>',
  '<div style="font-weight:800;font-size:x-large;color:#16a34a;">🛻 GMC SIERRA DENALI 2026</div>',
  '<div style="font-weight:800;">0 KM · ROJA · ENGANCHE A TU NOMBRE</div>',
  '<div style="font-weight:800;">+ $50,000 MXN EN EFECTIVO</div>',
  '<div><br></div>',
  '<div style="font-weight:700;">DEL 2DO AL 10MO LUGAR</div>',
  '<div style="font-weight:800;color:#16a34a;font-size:large;">$5,000 MXN CADA UNO</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#dc2626;">🔥 BONO PRONTO PAGO</div>',
  '<div>te llevas <span style="font-weight:800;color:#16a34a;">$30,000 MXN</span> extra si liquidas</div>',
  '<div>tu boleto antes de 12 hrs de apartado</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#7c3aed;">💎 BONO DENALI $100,000 MXN</div>',
  '<div>comprando más de 10 boletos en una sola exhibición</div>',
  '<div style="font-weight:700;">¡NO DESPRECIES TUS BOLETOS!</div>',
].join('');

const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.riferoProfile.findFirst({ where: { slug: SLUG } });
  if (!profile) throw new Error(`No encontré el rifero "${SLUG}"`);
  const raffle = await prisma.raffle.findFirst({ where: { riferoId: profile.id, eventNumber: EVENT } });
  if (!raffle) throw new Error(`No encontré la rifa E${EVENT}`);

  await prisma.raffle.update({ where: { id: raffle.id }, data: { description: DESCRIPTION } });
  console.log('✅ Descripción actualizada para', raffle.title);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

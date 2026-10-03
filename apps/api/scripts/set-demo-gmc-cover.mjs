// One-off: pone la foto de la GMC como imagen principal de la rifa demo E2
// y actualiza título/premio a GMC. Idempotente (vuelve a dejar una sola imagen).
//   node scripts/set-demo-gmc-cover.mjs
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const SLUG = 'rifasdelasuerte';
const EVENT = 2;
const COVER_URL = '/uploads/covers/demo-gmc-2026.jpg';
const NEW_TITLE = 'GMC Denali 2026';
const NEW_PRIZE = 'GMC Sierra Denali 2026';

const prisma = new PrismaClient();

async function main() {
  // El archivo debe existir físicamente.
  const filePath = join(__dirname, '..', 'uploads', 'covers', 'demo-gmc-2026.jpg');
  if (!existsSync(filePath)) {
    throw new Error(`No existe el archivo: ${filePath}`);
  }

  const profile = await prisma.riferoProfile.findFirst({ where: { slug: SLUG } });
  if (!profile) throw new Error(`No encontré el rifero con slug "${SLUG}"`);

  const raffle = await prisma.raffle.findFirst({
    where: { riferoId: profile.id, eventNumber: EVENT },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!raffle) throw new Error(`No encontré la rifa E${EVENT} del rifero "${SLUG}"`);

  console.log('── ANTES ──');
  console.log('  título:', raffle.title);
  console.log('  premio:', raffle.prize);
  console.log('  imágenes:', raffle.images.map((i) => i.url));

  await prisma.$transaction([
    prisma.raffleImage.deleteMany({ where: { raffleId: raffle.id } }),
    prisma.raffleImage.create({ data: { raffleId: raffle.id, url: COVER_URL, sortOrder: 0 } }),
    prisma.raffle.update({
      where: { id: raffle.id },
      data: { title: NEW_TITLE, prize: NEW_PRIZE },
    }),
  ]);

  const after = await prisma.raffle.findUnique({
    where: { id: raffle.id },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  console.log('── DESPUÉS ──');
  console.log('  título:', after.title);
  console.log('  premio:', after.prize);
  console.log('  imágenes:', after.images.map((i) => i.url));
  console.log('✅ Listo.');
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

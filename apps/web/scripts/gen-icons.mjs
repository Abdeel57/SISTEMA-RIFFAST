// Genera los íconos PNG de la PWA a partir de los SVG de /public.
// iOS y muchas tiendas/instaladores prefieren PNG; el SVG no basta para
// "Agregar a pantalla de inicio" ni para la instalabilidad de Lighthouse.
//
// Uso: node scripts/gen-icons.mjs   (o: npm run gen:icons)
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function png(svgFile, size, outFile) {
  const svg = await readFile(join(PUBLIC, svgFile));
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC, outFile));
  console.log('  ✓', outFile, `(${size}×${size})`);
}

console.log('Generando íconos PNG…');
await png('icon.svg', 192, 'icon-192.png');
await png('icon.svg', 512, 'icon-512.png');
await png('maskable-icon.svg', 512, 'maskable-512.png');
await png('apple-touch-icon.svg', 180, 'apple-touch-icon.png');
await png('favicon.svg', 32, 'favicon-32.png');

// Ícono pequeño de las notificaciones (badge de Android): silueta BLANCA del
// trébol sobre transparente. Android lo pinta monocromo; uno a color se ve
// como un cuadro blanco en la barra de estado.
{
  const svg = await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'riffast-clover.svg'));
  const { data, info } = await sharp(svg, { density: 384 })
    .resize(76, 76, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC, 'badge-96.png'));
  console.log('  ✓', 'badge-96.png', '(96×96, monocromo)');
}

// Imagen por defecto para vista previa de enlaces (Open Graph) 1200×630:
// fondo "noche" con el logotipo horizontal de Riffast (versión clara) centrado.
// Es el fallback cuando una rifa no tiene imagen propia (la edge function usa
// la de la rifa cuando existe).
const ASSETS = join(PUBLIC, '..', 'src', 'assets');
const logo = await sharp(await readFile(join(ASSETS, 'riffast-logo-light.svg')), { density: 384 })
  .resize(760, null)
  .png()
  .toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#03120C' } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(join(PUBLIC, 'og-default.png'));
console.log('  ✓ og-default.png (1200×630)');
console.log('Listo.');

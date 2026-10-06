// Tarjeta de "compartir" (og:image) con la identidad del rifero.
//
// WhatsApp, Facebook y Telegram muestran la vista previa GRANDE solo con imágenes
// horizontales 1.91:1 (1200×630) y ligeras (< ~300 KB); una cuadrada sale como
// miniatura. Por eso se compone al vuelo un JPG 1200×630:
//   - Página del rifero: su portada oscurecida con sus colores (o, sin portada, un
//     degradado de su color principal) y su logo grande al centro.
//   - Rifa: la foto del premio de fondo y el logo del rifero abajo a la izquierda.
// El logo va directo si contrasta con el fondo; si no (un logo blanco sobre fondo
// claro, uno oscuro sobre fondo oscuro) va sobre una placa redondeada clara u
// oscura. Antes se ponía siempre sobre blanco y un logo blanco desaparecía.
// Sin texto dentro de la imagen: el servidor no tiene fuentes garantizadas y el
// título y la descripción ya los muestra la red social debajo.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export const CARD_W = 1200;
export const CARD_H = 630;
// Súbelo si cambia el diseño: cambia el `?v=` y las redes vuelven a pedir la imagen.
const DESIGN_VERSION = '2';
const MAX_BYTES = 280 * 1024;

export interface CardBrand {
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

interface CardInput {
  brand: CardBrand;
  // Foto del premio (tarjeta de una rifa). Sin foto → tarjeta de la página.
  photoUrl?: string | null;
}

// ¿Hay algo con qué componer? Sin logo ni portada (ni foto) se usa og-default.
export function hasCardSource(input: CardInput): boolean {
  return Boolean(input.photoUrl || input.brand.logoUrl || input.brand.coverUrl);
}

// Ruta del endpoint con un token de versión derivado de lo que se dibuja: cuando
// el rifero cambia logo, portada, colores o la foto del premio, cambia el `?v=` y
// las redes invalidan su caché.
export function shareCardRelUrl(brand: CardBrand | null, event?: { number: number; photoUrl: string | null }): string {
  const b = brand ?? { logoUrl: null, coverUrl: null, primaryColor: null, secondaryColor: null };
  const photo = event?.photoUrl ?? null;
  const v = createHash('sha1')
    .update([DESIGN_VERSION, b.logoUrl, b.coverUrl, b.primaryColor, b.secondaryColor, photo].join('|'))
    .digest('hex')
    .slice(0, 10);
  return event && photo ? `/s/card.jpg?e=${event.number}&v=${v}` : `/s/card.jpg?v=${v}`;
}

// ── Color ────────────────────────────────────────────────────────────────────
type Rgb = [number, number, number];

function parseHex(hex: string | null | undefined, fallback: Rgb): Rgb {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return fallback;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
const hex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: Rgb) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const BLACK: Rgb = [0, 0, 0];
const GREEN: Rgb = [0, 139, 90]; // verde Riffast (#008B5A) si el rifero no eligió color
const INK: Rgb = [3, 18, 12];

// ── Lectura de imágenes ──────────────────────────────────────────────────────
async function loadBytes(srcUrl: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(srcUrl)) {
      const res = await fetch(srcUrl, { signal: AbortSignal.timeout(8000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    if (srcUrl.startsWith('/uploads/')) {
      const key = srcUrl.slice('/uploads/'.length);
      if (env.storage.driver === 'db') {
        const asset = await prisma.storedAsset.findUnique({ where: { key } });
        return asset ? Buffer.from(asset.bytes) : null;
      }
      return await readFile(join(env.storage.localDir, key));
    }
    if (srcUrl.startsWith('/demo-assets/')) {
      const rel = srcUrl.slice('/demo-assets/'.length);
      const dir = fileURLToPath(new URL('../../../prisma/demo-assets/', import.meta.url));
      return await readFile(join(dir, rel));
    }
    return null;
  } catch {
    return null; // archivo ausente o ilegible → se dibuja sin esa imagen
  }
}

// Fondo a pantalla completa (portada o foto del premio), recortado con atención.
async function photoLayer(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize(CARD_W, CARD_H, { fit: 'cover', position: sharp.strategy.attention })
      .removeAlpha()
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

interface LogoInfo {
  png: Buffer;
  width: number;
  height: number;
  lums: number[]; // luminancia de una muestra de los píxeles visibles del logo
  solid: boolean; // logo rectangular con fondo propio (JPG, PNG sin transparencia)
}

async function sample(buf: Buffer): Promise<{ lums: number[]; opaqueShare: number }> {
  const { data, info } = await sharp(buf)
    .resize(96, 96, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lums: number[] = [];
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 250) opaque += 1;
    if (a > 128) lums.push(luminance([data[i], data[i + 1], data[i + 2]]));
  }
  return { lums, opaqueShare: opaque / (info.width * info.height) };
}

async function readLogo(bytes: Buffer, maxW: number, maxH: number): Promise<LogoInfo | null> {
  try {
    let base = await sharp(bytes, { density: 300 }).ensureAlpha().png().toBuffer();
    const first = await sample(base);
    const solid = first.opaqueShare > 0.92;
    // Logo con transparencia: se quita el margen vacío para centrar el dibujo, no
    // el lienzo. Uno con fondo propio se deja entero (si no, el dibujo toca el borde).
    if (!solid) base = await sharp(base).trim({ threshold: 2 }).png().toBuffer().catch(() => base);
    const { lums } = solid ? first : await sample(base);
    if (lums.length === 0) return null; // logo vacío

    const png = await sharp(base).resize(maxW, maxH, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
    const meta = await sharp(png).metadata();
    return { png, width: meta.width ?? maxW, height: meta.height ?? maxH, lums, solid };
  } catch {
    return null;
  }
}

// Parte del logo que casi no se distingue de un fondo de esa luminancia. Se mide
// píxel a píxel: con el promedio, un logo de dos tonos (trébol verde + letras
// oscuras) "pasaba" sobre fondo oscuro y las letras desaparecían.
function hiddenShare(logo: LogoInfo, bgLum: number): number {
  let hidden = 0;
  for (const l of logo.lums) if (contrast(l, bgLum) < 1.6) hidden += 1;
  return hidden / logo.lums.length;
}

// Esquinas redondeadas para un logo rectangular con fondo propio.
async function roundCorners(logo: LogoInfo, radius: number): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${logo.width}" height="${logo.height}"><rect width="${logo.width}" height="${logo.height}" rx="${radius}" fill="#fff"/></svg>`,
  );
  return sharp(logo.png).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

// Placa redondeada con sombra suave, del tamaño del logo más su margen.
function plateSvg(x: number, y: number, w: number, h: number, fill: string, radius: number): Buffer {
  return Buffer.from(`<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-30%" y="-30%" width="160%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dy="16" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.32"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" filter="url(#s)"/>
</svg>`);
}

// ── Composición ─────────────────────────────────────────────────────────────
const memo = new Map<string, Buffer>();

export async function composeShareCard(input: CardInput): Promise<Buffer | null> {
  if (!hasCardSource(input)) return null;
  const key = JSON.stringify(input);
  const cached = memo.get(key);
  if (cached) return cached;

  const { brand } = input;
  const primary = parseHex(brand.primaryColor, GREEN);
  const secondary = parseHex(brand.secondaryColor, INK);
  const deep = mix(secondary, BLACK, 0.35);
  const isEvent = Boolean(input.photoUrl);

  // 1) Fondo
  const layers: sharp.OverlayOptions[] = [];
  const photoSrc = input.photoUrl || brand.coverUrl;
  const photoBytes = photoSrc ? await loadBytes(photoSrc) : null;
  const photo = photoBytes ? await photoLayer(photoBytes) : null;

  let bgLum: number;
  let base: sharp.Sharp;
  if (photo) {
    base = sharp(photo);
    // Velo de los colores del rifero: oscurece lo justo para que el logo resalte.
    const veil = isEvent
      ? `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0.35" stop-color="${hex(deep)}" stop-opacity="0"/>
           <stop offset="1" stop-color="${hex(deep)}" stop-opacity="0.82"/>
         </linearGradient>`
      : `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0" stop-color="${hex(deep)}" stop-opacity="0.78"/>
           <stop offset="1" stop-color="${hex(mix(primary, BLACK, 0.4))}" stop-opacity="0.6"/>
         </linearGradient>`;
    layers.push({
      input: Buffer.from(
        `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg"><defs>${veil}</defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
      ),
    });
    bgLum = luminance(mix(deep, BLACK, 0.2));
  } else {
    const light = mix(primary, [255, 255, 255], 0.18);
    const dark = mix(primary, secondary, 0.55);
    const svg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hex(light)}"/>
      <stop offset="1" stop-color="${hex(dark)}"/>
    </linearGradient>
    <radialGradient id="r" cx="0.22" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`;
    base = sharp(Buffer.from(svg));
    bgLum = luminance(mix(light, dark, 0.5));
  }

  // 2) Logo
  const logoBytes = brand.logoUrl ? await loadBytes(brand.logoUrl) : null;
  const maxW = isEvent ? 300 : 560;
  const maxH = isEvent ? 140 : 300;
  const logo = logoBytes ? await readLogo(logoBytes, maxW, maxH) : null;

  if (logo) {
    const pad = isEvent ? 26 : 48;
    // Placa (de color claro u oscuro, la que deje ver más del logo; a igualdad,
    // blanca): siempre sobre una foto, que es impredecible y cargada; sobre el
    // degradado, solo si una parte del logo se pierde en el fondo.
    const needsPlate = !logo.solid && (photo !== null || hiddenShare(logo, bgLum) > 0.12);
    const darkPlate = mix(secondary, BLACK, 0.55);
    const plateFill =
      hiddenShare(logo, 1) <= hiddenShare(logo, luminance(darkPlate)) ? '#ffffff' : hex(darkPlate);
    const boxW = logo.width + (needsPlate ? pad * 2 : 0);
    const boxH = logo.height + (needsPlate ? pad * 2 : 0);
    const boxX = isEvent ? 48 : Math.round((CARD_W - boxW) / 2);
    const boxY = isEvent ? CARD_H - 48 - boxH : Math.round((CARD_H - boxH) / 2);

    if (needsPlate) layers.push({ input: plateSvg(boxX, boxY, boxW, boxH, plateFill, isEvent ? 22 : 36) });
    const art = logo.solid ? await roundCorners(logo, isEvent ? 18 : 28) : logo.png;
    layers.push({ input: art, left: boxX + (needsPlate ? pad : 0), top: boxY + (needsPlate ? pad : 0) });
  } else if (!photo) {
    return null; // sin logo legible ni foto: no hay identidad que mostrar → og-default
  }

  // 3) JPG ligero (las redes descartan imágenes pesadas).
  try {
    const flat = await base.composite(layers).png().toBuffer();
    let quality = 84;
    let jpg = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    while (jpg.length > MAX_BYTES && quality > 60) {
      quality -= 8;
      jpg = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    }
    if (memo.size > 24) memo.clear();
    memo.set(key, jpg);
    return jpg;
  } catch {
    return null; // imagen corrupta → og-default
  }
}

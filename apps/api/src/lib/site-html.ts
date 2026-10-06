import type { FastifyRequest } from 'fastify';
import { isCurrency, isLocale } from '@riffast/shared';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { escapeHtml } from './mailer.js';
import { hasCardSource, shareCardRelUrl } from '../modules/og/share-card.js';
import {
  ADMIN_DESCRIPTION,
  adminTitle,
  eventNumberFromPath,
  findShareRaffle,
  raffleDescription,
  raffleTitle,
  siteDescription,
} from '../modules/og/share-text.js';

// Inyecta la marca del rifero del sitio (favicon, título y meta tags Open Graph)
// en el index.html que sirve el backend. Así, ANTES de que cargue el JS:
//   - la pestaña del navegador muestra el logo y el nombre de la página de rifas;
//   - al compartir un enlace (WhatsApp, Facebook…), la vista previa lleva la
//     tarjeta con el logo y los colores del rifero; en una rifa, además, la foto
//     del premio, el título, el premio, el precio y la fecha del sorteo.
// Los crawlers no ejecutan JS: todo esto tiene que venir en el HTML del servidor.
// Es single-tenant: hay un solo rifero por despliegue. Se cachea el perfil unos
// segundos para no pegarle a la BD en cada carga de HTML.

interface BrandProfile {
  id: string;
  publicName: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  publicDarkMode: boolean;
  locale: string;
  currency: string;
  facebookPixelId: string | null;
  facebookDomainVerification: string | null;
}

let cache: { profile: BrandProfile | null; at: number } | null = null;
const TTL_MS = 30_000;

async function getSiteProfile(): Promise<BrandProfile | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.profile;
  const profile = await prisma.riferoProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      publicName: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      primaryColor: true,
      secondaryColor: true,
      publicDarkMode: true,
      locale: true,
      currency: true,
      facebookPixelId: true,
      facebookDomainVerification: true,
    },
  });
  cache = { profile, at: now };
  return profile;
}

function absolute(url: string | null | undefined, request: FastifyRequest): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Reemplaza el content de <meta property="X" ...> sin romper si el valor trae $.
function setProp(html: string, prop: string, value: string): string {
  const re = new RegExp(`(<meta property="${prop}" content=")[^"]*(")`);
  return html.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`);
}
function setName(html: string, name: string, value: string): string {
  const re = new RegExp(`(<meta name="${name}" content=")[^"]*(")`);
  return html.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`);
}
// Como setProp/setName, pero si la etiqueta no existe la añade antes de </head>.
function upsertMeta(html: string, attr: 'property' | 'name', key: string, value: string): string {
  if (new RegExp(`<meta ${attr}="${key}" content=`).test(html)) {
    return attr === 'property' ? setProp(html, key, value) : setName(html, key, value);
  }
  return html.replace('</head>', `  <meta ${attr}="${key}" content="${escapeHtml(value)}" />\n  </head>`);
}

interface ShareMeta {
  siteName: string;
  title: string;
  description: string;
  image: string; // URL ABSOLUTA: WhatsApp ignora una relativa y la vista previa sale vacía
  url: string;
}

// Vista previa al compartir (Open Graph + Twitter). La tarjeta mide 1200×630: el
// formato horizontal que WhatsApp y Facebook muestran en grande.
function applyShareMeta(rawHtml: string, m: ShareMeta): string {
  let html = rawHtml;
  html = upsertMeta(html, 'property', 'og:site_name', m.siteName);
  html = upsertMeta(html, 'property', 'og:title', m.title);
  html = upsertMeta(html, 'property', 'og:description', m.description);
  html = upsertMeta(html, 'property', 'og:url', m.url);
  html = upsertMeta(html, 'property', 'og:image', m.image);
  html = upsertMeta(html, 'property', 'og:image:width', '1200');
  html = upsertMeta(html, 'property', 'og:image:height', '630');
  html = upsertMeta(html, 'property', 'og:image:alt', m.title);
  html = upsertMeta(html, 'name', 'description', m.description);
  html = upsertMeta(html, 'name', 'twitter:title', m.title);
  html = upsertMeta(html, 'name', 'twitter:description', m.description);
  html = upsertMeta(html, 'name', 'twitter:image', m.image);
  return html;
}

function siteBase(request: FastifyRequest): string {
  return env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
}

// og:image: la tarjeta del rifero (o de la rifa, con la foto del premio). Sin
// logo, portada ni foto no hay nada propio que dibujar: va directo la imagen por
// defecto, sin pasar por una redirección (no todos los lectores la siguen).
function cardImage(
  profile: BrandProfile,
  request: FastifyRequest,
  fallback: string,
  event?: { number: number; photoUrl: string | null },
): string {
  const brand = {
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
  };
  if (!hasCardSource({ brand, photoUrl: event?.photoUrl })) return fallback;
  return absolute(shareCardRelUrl(brand, event), request) ?? fallback;
}

// Código base OFICIAL del pixel de Meta, palabra por palabra como lo entrega
// Events Manager. Va dentro del <head> del HTML que sirve el backend —no
// inyectado por JavaScript— por dos razones: aparece en el código fuente de la
// página (es lo que revisa el rastreador de Meta y el cliente al inspeccionar) y
// el PageView sale de inmediato, sin esperar a que responda la API del perfil.
//
// El ID se filtra a DÍGITOS: entra dentro de un <script>, donde escapar HTML no
// serviría de nada y un valor con comillas sería una inyección de código.
function metaPixelSnippet(rawId: string): string {
  const id = rawId.replace(/[^0-9]/g, '');
  if (!id) return '';
  return `    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"
    /></noscript>
    <!-- End Meta Pixel Code -->
`;
}

// Mete en el <head> la verificación de dominio y el pixel de Meta. Función pura
// (recibe el HTML y devuelve el HTML) para poder probarla sin base de datos.
export function injectMeta(
  rawHtml: string,
  rawPixelId: string | null | undefined,
  rawVerification: string | null | undefined,
): string {
  let html = rawHtml;

  // La verificación de dominio es una meta etiqueta que Meta lee SIN ejecutar
  // JavaScript, así que tiene que venir en el HTML del servidor: por eso el
  // rifero no podía ponerla desde el panel hasta ahora.
  const verification = (rawVerification ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  if (verification) {
    html = html.replace(
      '</head>',
      `  <meta name="facebook-domain-verification" content="${escapeHtml(verification)}" />\n  </head>`,
    );
  }

  const pixelId = (rawPixelId ?? '').replace(/[^0-9]/g, '');
  if (pixelId) {
    html = html.replace('</head>', `${metaPixelSnippet(pixelId)}  </head>`);
    // Marca para el frontend: el pixel YA quedó iniciado y su PageView ya salió.
    // Sin esto, el hook useFacebookPixel mandaría un segundo PageView por carga.
    html = html.replace('<html', `<html data-fb-pixel="${pixelId}"`);
  }

  return html;
}

const ADMIN_TITLE = 'Riffast | ADMIN'; // pestaña del navegador
const ADMIN_APP_NAME = 'Riffast'; // nombre debajo del ícono de la app instalada
// Mismo gris que el fondo del panel (debe coincidir con ADMIN_THEME_COLOR de
// apps/web/src/store/theme.ts).
const ADMIN_THEME_COLOR = '#F5F5F7';

// El administrador (/admin, /login) lleva la marca Riffast en la pestaña, el
// ícono y la app instalada: el panel es del producto. Le dejamos los íconos
// estáticos de Riffast, el título "Riffast | ADMIN" y un manifest dedicado (abre
// directo en /admin con el ícono de Riffast). La vista previa al COMPARTIR el
// enlace sí lleva la identidad del rifero (ver renderBrandedIndex): quien lo
// recibe (un vendedor, un socio) ve de qué página es el panel.
function renderAdminIndex(rawHtml: string): string {
  let html = rawHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${ADMIN_TITLE}</title>`);
  html = setName(html, 'apple-mobile-web-app-title', ADMIN_APP_NAME);
  // El panel es claro (fondo #F5F5F7, estilo iOS). iOS lee la barra de estado
  // del HTML al abrir la app instalada: con «black-translucent» el reloj y la
  // batería salían en blanco sobre blanco. «default» = texto oscuro legible.
  html = setName(html, 'apple-mobile-web-app-status-bar-style', 'default');
  html = setName(html, 'theme-color', ADMIN_THEME_COLOR);
  html = html.replace('href="/manifest.webmanifest"', 'href="/admin.webmanifest"');
  return html;
}

export async function renderBrandedIndex(rawHtml: string, request: FastifyRequest): Promise<string> {
  const path = (request.url || '/').split('?')[0];
  const base = siteBase(request);
  const pageUrl = `${base}${path === '/' ? '' : path}`;
  const fallbackImage = `${base}/og-default.png`;

  let profile: BrandProfile | null = null;
  try {
    profile = await getSiteProfile();
  } catch {
    profile = null; // si la BD no responde, servimos el HTML sin marca (mejor que romper la carga)
  }

  if (path === '/login' || path === '/admin' || path.startsWith('/admin/')) {
    const html = renderAdminIndex(rawHtml);
    return applyShareMeta(html, {
      siteName: profile?.publicName ?? 'Riffast',
      title: profile ? adminTitle(profile) : 'Riffast · Panel de administración',
      description: ADMIN_DESCRIPTION,
      image: profile ? cardImage(profile, request, fallbackImage) : fallbackImage,
      url: pageUrl,
    });
  }

  if (!profile) {
    // Sin perfil igual damos una vista previa válida (imagen con URL absoluta).
    return applyShareMeta(rawHtml, {
      siteName: 'Rifas y sorteos',
      title: 'Rifas y sorteos',
      description: 'Aparta tus boletos, paga fácil y recibe tu boleto digital con QR.',
      image: fallbackImage,
      url: pageUrl,
    });
  }

  const name = profile.publicName;
  const logo = absolute(profile.logoUrl, request);

  // Vista previa al compartir (ver modules/og/share-card.ts y share-text.ts). En
  // una rifa visible: su título, premio, precio y fecha, y la foto del premio con
  // el logo del rifero; en el resto del sitio, la tarjeta de la página.
  const eventNumber = eventNumberFromPath(path);
  const raffle = eventNumber ? await findShareRaffle(profile.id, eventNumber).catch(() => null) : null;
  const share: ShareMeta = raffle
    ? {
        siteName: name,
        title: raffleTitle(raffle, profile),
        description: raffleDescription(raffle, profile),
        image: cardImage(profile, request, fallbackImage, { number: eventNumber!, photoUrl: raffle.photoUrl }),
        url: pageUrl,
      }
    : {
        siteName: name,
        title: name,
        description: siteDescription(profile),
        image: cardImage(profile, request, fallbackImage),
        url: pageUrl,
      };

  let html = rawHtml;

  // Tema oscuro de la página pública (lo elige el rifero). Se inyecta la clase
  // `dark` en <html> ANTES de que cargue el JS para no parpadear (claro→oscuro).
  // (Las rutas del administrador ya salieron arriba por renderAdminIndex.)
  if (profile.publicDarkMode) {
    html = html.replace(/<html(\s[^>]*)?>/i, (m, attrs: string | undefined) => {
      const a = attrs ?? '';
      return /class\s*=/.test(a)
        ? `<html${a.replace(/class\s*=\s*"([^"]*)"/i, (_x, c: string) => `class="${c} dark"`)}>`
        : `<html${a} class="dark">`;
    });
  }

  // Color de fondo DESDE EL PRIMER PINTADO. La franja de arriba del teléfono
  // (hora, señal, batería) la pinta el navegador: Safari en iPhone la tiñe con
  // el fondo del <body>, y otros usan <meta theme-color>; por eso se ponen los
  // dos, en línea para ganarle a la hoja de estilos (que pinta el body blanco).
  //
  // Se usa el color de la PANTALLA DE CARGA, no el de la marca: lo primero que
  // ve el comprador es esa pantalla, y pintar el fondo del color del rifero
  // provocaba un destello a pantalla completa ANTES de que apareciera y otro al
  // desvanecerse. Con este color la carga es continua, y al terminar RiferoTheme
  // cambia fondo y theme-color al color del rifero: aparece todo junto, con el
  // resto de la página. Debe coincidir con el fondo de la intro de Riffast
  // (public/riffast-intro.js) y de BrandLoader: verde #008B5A.
  const LOADER_BG = '#008B5A';
  html = setName(html, 'theme-color', LOADER_BG);
  html = html.replace(/<body(\s[^>]*)?>/i, (_m, attrs: string | undefined) => {
    const a = (attrs ?? '').replace(/\sstyle\s*=\s*"[^"]*"/i, '');
    return `<body${a} style="background-color:${LOADER_BG}">`;
  });

  // Idioma y moneda del sitio ("Modo USA"), por la misma razón que el tema: el
  // store del frontend los lee de estos atributos en el primer render, así la
  // página nunca se ve un instante en español antes de cambiar a inglés.
  const locale = isLocale(profile.locale) ? profile.locale : 'es';
  const currency = isCurrency(profile.currency) ? profile.currency : 'MXN';
  html = html.replace(/<html(\s[^>]*)?>/i, (_m, attrs: string | undefined) => {
    const a = (attrs ?? '').replace(/\slang\s*=\s*"[^"]*"/i, '');
    return `<html${a} lang="${locale}" data-locale="${locale}" data-currency="${currency}" style="background-color:${LOADER_BG}">`;
  });

  // Título de la pestaña → nombre de la página de rifas.
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(name)}</title>`);

  // Favicon → logo del rifero (si tiene uno). Sustituye los íconos estáticos.
  if (logo) {
    html = html
      .replace(/\s*<link rel="icon"[^>]*>/g, '')
      .replace(/(<link rel="apple-touch-icon")[^>]*\/>/, `$1 href="${escapeHtml(logo)}" />`)
      .replace('</head>', `  <link rel="icon" href="${escapeHtml(logo)}" />\n  </head>`);
  }

  // Open Graph / Twitter → identidad de la página (o de la rifa).
  html = applyShareMeta(html, share);
  html = setName(html, 'apple-mobile-web-app-title', name);

  // Meta (Facebook): verificación de dominio + pixel. Solo en páginas públicas
  // (el administrador salió antes por renderAdminIndex).
  html = injectMeta(html, profile.facebookPixelId, profile.facebookDomainVerification);

  return html;
}

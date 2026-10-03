// Verifica que la página pública de una rifa NO truena con el render de
// descripción enriquecida (isRichHtml + sanitizeHtml). Uso: node qa/diag-richtext-public.mjs
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const API = 'http://localhost:4000';
const WEB = 'http://localhost:5173';
const SLUG = 'rifasdelasuerte';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cookie = '';
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  const c = sc.find((x) => x.startsWith('bsk_session='));
  if (c) cookie = c.split(';')[0];
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

const RICH = '<div style="text-align:center"><font color="#dc2626" size="6"><b>GRAN RIFA NORTEÑA</b></font></div><div>2º LUGAR: $5,000 MXN</div><div><i>¡Participa ya!</i></div>';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
async function loadPage(url, label) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle2' }).catch((e) => errors.push('goto:' + e.message));
  await sleep(1500);
  const info = await page.evaluate(() => ({
    title: document.title,
    rtText: document.querySelector('.rt-content')?.textContent?.trim() ?? null,
    hasBold: !!document.querySelector('.rt-content b, .rt-content strong'),
    bodyLen: document.body.innerText.length,
  }));
  await page.close();
  console.log(`\n[${label}] ${url}`);
  console.log(`  errores runtime: ${errors.length ? '❌ ' + errors.slice(0, 3).join(' | ') : '✅ ninguno'}`);
  console.log(`  título: ${info.title} · texto cuerpo: ${info.bodyLen} chars`);
  if (info.rtText !== null) console.log(`  .rt-content: "${info.rtText.slice(0, 60)}" · negrita=${info.hasBold}`);
  return { errors, info };
}

try {
  // 1) Página pública de una rifa existente → debe montar sin crashear
  await loadPage(`${WEB}/r/${SLUG}/e1`, 'existente E1');

  // 2) Crear rifa con descripción enriquecida (demo tiene plan) + publicar
  await api('/auth/login', { method: 'POST', body: { email: 'demo@bismark.com', password: 'Demo1234!' } });
  const created = await api('/raffles', {
    method: 'POST',
    body: { title: 'Rifa RichText QA', prize: 'Premio', description: RICH, ticketPrice: 50, totalTickets: 50, ticketFormat: 3, ticketStart: 1 },
  });
  const raffle = created.data?.raffle;
  console.log(`\ncrear rica   -> ${created.status} (E${raffle?.eventNumber})`);
  const pub = await api(`/raffles/${raffle?.id}/publish`, { method: 'POST' });
  console.log(`publicar     -> ${pub.status} ${pub.status !== 200 ? JSON.stringify(pub.data)?.slice(0, 120) : ''}`);

  if (pub.status === 200) {
    const r = await loadPage(`${WEB}/r/${SLUG}/e${raffle.eventNumber}`, 'rich nueva');
    const ok = r.errors.length === 0 && r.info.rtText?.includes('GRAN RIFA') && r.info.hasBold;
    console.log(`\n  >> RENDER ENRIQUECIDO: ${ok ? '✅ OK (formato visible, sin errores)' : '❌ revisar'}`);
  }

  // 3) Limpieza: borrar la rifa de prueba
  if (raffle?.id) {
    const { PrismaClient } = await import(`file://${process.cwd().replace(/\\/g, '/')}/apps/api/node_modules/@prisma/client/default.js`).catch(() => ({}));
    void PrismaClient; // borramos por script externo abajo si hace falta
  }
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

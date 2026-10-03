// Verifica el cronómetro al sorteo en la página pública de la rifa.
// Caso 1: sorteo futuro → cuenta regresiva en vivo. Caso 2: fecha pasada → solo fecha.
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

async function makeRaffle(title, drawMsFromNow) {
  const drawDate = new Date(Date.now() + drawMsFromNow).toISOString();
  const r = await api('/raffles', {
    method: 'POST',
    body: { title, prize: 'Premio', ticketPrice: 50, totalTickets: 50, ticketFormat: 3, ticketStart: 1, drawDate },
  });
  const raffle = r.data?.raffle;
  const pub = await api(`/raffles/${raffle?.id}/publish`, { method: 'POST' });
  return { raffle, create: r.status, publish: pub.status, publishData: pub.data };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
async function readCountdown(eventNumber, label) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${WEB}/r/${SLUG}/e${eventNumber}`, { waitUntil: 'networkidle2' }).catch((e) => errs.push('goto:' + e.message));
  await sleep(1600);
  const out = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('section')];
    const cd = secs.find((s) => /faltan para el sorteo|sorteo realizado|fecha del sorteo/i.test(s.innerText));
    return cd ? cd.innerText.replace(/\n+/g, ' | ') : null;
  });
  // Espera 1.5s y vuelve a leer para confirmar que los segundos corren
  await sleep(1500);
  const out2 = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('section')];
    const cd = secs.find((s) => /faltan para el sorteo|sorteo realizado|fecha del sorteo/i.test(s.innerText));
    return cd ? cd.innerText.replace(/\n+/g, ' | ') : null;
  });
  await page.close();
  console.log(`\n[${label}] e${eventNumber}`);
  console.log(`  errores: ${errs.length ? '❌ ' + errs.slice(0, 2).join(' | ') : '✅ ninguno'}`);
  console.log(`  cronómetro: ${out ?? '∅ no encontrado'}`);
  console.log(`  +1.5s:      ${out2 ?? '∅'}  ${out && out2 && out !== out2 ? '⏱️ corre en vivo' : ''}`);
}

try {
  await api('/auth/login', { method: 'POST', body: { email: 'demo@bismark.com', password: 'Demo1234!' } });

  const fut = await makeRaffle('Cronometro Futuro QA', 5 * 86400000 + 3 * 3600000 + 27 * 60000);
  console.log(`futuro  -> crear ${fut.create} · publicar ${fut.publish} ${fut.publish !== 200 ? JSON.stringify(fut.publishData)?.slice(0, 120) : '(E' + fut.raffle?.eventNumber + ')'}`);
  if (fut.publish === 200) await readCountdown(fut.raffle.eventNumber, 'FUTURO → cuenta regresiva');

  const past = await makeRaffle('Cronometro Pasado QA', -2 * 86400000);
  console.log(`pasado  -> crear ${past.create} · publicar ${past.publish} ${past.publish !== 200 ? JSON.stringify(past.publishData)?.slice(0, 120) : '(E' + past.raffle?.eventNumber + ')'}`);
  if (past.publish === 200) await readCountdown(past.raffle.eventNumber, 'PASADO → solo fecha');
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

// Verifica el campo "Fecha del sorteo" del formulario de rifa:
//  A) es OBLIGATORIO (no deja crear sin fecha)
//  B) se GUARDA bien cuando se llena (drawDate en el POST)
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WEB = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
    if (b) b.click();
    return !!b;
  }, txt);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
let lastPost = null;
page.on('response', async (res) => {
  if (res.url().includes('/raffles') && res.request().method() === 'POST') {
    lastPost = { status: res.status(), body: await res.json().catch(() => null) };
  }
});

try {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.type('#email', 'demo@bismark.com');
  await page.type('#password', 'Demo1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel'), { timeout: 15000 }).catch(() => {});
  await sleep(2000);

  await page.goto(`${WEB}/panel/admin/rifas/nueva`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  await page.type('#title', 'Fecha Obligatoria QA');
  await page.type('#prize', 'Premio');
  await clickByText(page, 'Siguiente'); await sleep(700);
  await clickByText(page, 'Siguiente'); await sleep(700);
  await clickByText(page, 'Siguiente'); await sleep(700);

  // A) Intentar crear SIN fecha → debe bloquear
  lastPost = null;
  await clickByText(page, 'Crear rifa');
  await sleep(1200);
  const aState = await page.evaluate(() => ({
    url: location.pathname,
    err: [...document.querySelectorAll('.text-destructive, [role=alert]')].map((e) => e.textContent.trim()).filter(Boolean),
  }));
  const blocked = aState.url.includes('/nueva') && !lastPost;
  console.log(`A) sin fecha → ${blocked ? '✅ BLOQUEADO' : '❌ pasó'}  url=${aState.url}  err=${JSON.stringify(aState.err).slice(0, 80)}`);

  // B) Poner fecha (setter nativo para que React la registre) y crear
  await page.$eval('#drawDate', (el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, '2026-09-15T20:00');
  await sleep(400);
  lastPost = null;
  await clickByText(page, 'Crear rifa');
  await sleep(2500);
  const draw = lastPost?.body?.raffle?.drawDate;
  console.log(`B) con fecha → POST ${lastPost?.status}  drawDate=${draw ?? 'null'}  ${draw ? '✅ GUARDADA' : '❌ no guardó'}`);
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

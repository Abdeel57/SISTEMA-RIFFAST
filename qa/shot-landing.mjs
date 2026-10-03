import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4173';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();

  // 1) Sección "Todo incluido" en escritorio (3 tarjetas en fila).
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1200);
  // Dispara todos los Reveal (IntersectionObserver) recorriendo la página.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    window.scrollTo(0, 0);
  });
  await sleep(500);
  const el = await page.$('#beneficios');
  await el.screenshot({ path: `${OUT}\\bsk-bento.png` }); // hace scroll al elemento y recorta a él
  console.log('OK bento ->', `${OUT}\\bsk-bento.png`);

  // 2) Página completa en móvil (para ver el largo general).
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);
  // Fuerza que todos los Reveal queden visibles antes del fullPage.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await sleep(600);
  const full = await page.evaluate(() => document.body.scrollHeight);
  console.log('altura total móvil (px):', full);
  await page.screenshot({ path: `${OUT}\\bsk-landing-full.png`, fullPage: true });
  console.log('OK full ->', `${OUT}\\bsk-landing-full.png`);
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

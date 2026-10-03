import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
    if (b) b.click();
    return !!b;
  }, txt);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE.ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('/raffles') && res.request().method() === 'POST') {
    let body = '';
    try { body = JSON.stringify(await res.json()); } catch { body = await res.text().catch(() => ''); }
    console.log(`POST /raffles -> ${res.status()} : ${body.slice(0, 400)}`);
  }
});
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.type('#email', 'demo@bismark.com');
  await page.type('#password', 'Demo1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel'), { timeout: 15000 }).catch(() => {});
  await sleep(2200);

  await page.goto(`${BASE}/panel/admin/rifas/nueva`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  await page.type('#title', 'Rifa diagnóstico');
  await page.type('#prize', 'Premio de prueba');
  console.log('siguiente1:', await clickByText(page, 'Siguiente')); await sleep(900);
  console.log('siguiente2:', await clickByText(page, 'Siguiente')); await sleep(900);
  console.log('siguiente3:', await clickByText(page, 'Siguiente')); await sleep(900);

  // Paso 4: fecha de sorteo + crear
  await page.evaluate(() => {
    const d = document.querySelector('#drawDate');
    if (d) {
      d.value = '2026-12-31T20:00';
      d.dispatchEvent(new Event('input', { bubbles: true }));
      d.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(400);
  console.log('crear:', await clickByText(page, 'Crear rifa'));
  await sleep(2500);
  console.log('URL final:', page.url());
  // Errores de validación visibles (RHF) + toasts
  const errs = await page.evaluate(() => {
    const fieldErrs = [...document.querySelectorAll('.text-destructive')].map((e) => e.textContent.trim()).filter(Boolean);
    const toasts = [...document.querySelectorAll('[data-sonner-toast]')].map((e) => e.innerText.trim());
    return { fieldErrs, toasts };
  });
  console.log('errores de campo:', JSON.stringify(errs.fieldErrs));
  console.log('toasts:', JSON.stringify(errs.toasts));
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

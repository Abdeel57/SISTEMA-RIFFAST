import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const IMG = `${process.env.TEMP}\\small.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
    if (b) b.click();
    return !!b;
  }, txt);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
page.on('response', async (res) => {
  const u = res.url();
  if ((u.includes('/raffles') || u.includes('/uploads-api')) && res.request().method() === 'POST') {
    let body = '';
    try { body = JSON.stringify(await res.json()); } catch { body = ''; }
    console.log(`POST ${u.replace(BASE, '')} -> ${res.status()} : ${body.slice(0, 300)}`);
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
  await page.type('#title', 'Rifa con foto');
  await page.type('#prize', 'Premio con imagen');
  await clickByText(page, 'Siguiente'); await sleep(800); // -> boletos
  await clickByText(page, 'Siguiente'); await sleep(800); // -> imágenes

  // Subir imagen
  const fileInput = await page.$('input[type=file]');
  if (fileInput) { await fileInput.uploadFile(IMG); console.log('archivo enviado'); }
  await sleep(2500); // esperar subida

  await clickByText(page, 'Siguiente'); await sleep(800); // -> fechas
  console.log('crear:', await clickByText(page, 'Crear rifa'));
  await sleep(2800);
  console.log('URL final:', page.url());
  const out = await page.evaluate(() => ({
    fieldErrs: [...document.querySelectorAll('.text-destructive')].map((e) => e.textContent.trim()).filter(Boolean),
    toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((e) => e.innerText.trim()),
  }));
  console.log('errores:', JSON.stringify(out.fieldErrs), 'toasts:', JSON.stringify(out.toasts));
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 920, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.type('#email', 'demo@bismark.com');
  await page.type('#password', 'Demo1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel'), { timeout: 15000 }).catch(() => {});
  await sleep(2500);

  await page.goto(`${BASE}/panel/admin/rifas/nueva`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: `${OUT}\\bsk-form-step1.png` });
  console.log('shot step1');

  // Llenar título y avanzar al paso 2
  await page.type('#title', 'Gran rifa de la camioneta');
  await page.type('#prize', 'Camioneta 2024 0 km');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Siguiente');
    b?.click();
  });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}\\bsk-form-step2.png` });
  console.log('shot step2');
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

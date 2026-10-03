import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email);
  await page.type('#password', password);
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForFunction(() => location.pathname.startsWith('/panel') || location.pathname.startsWith('/admin'), { timeout: 15000 }).catch(() => {}),
  ]);
  await sleep(2800);
}

async function shot(page, path, file, w = 1340, h = 900) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.screenshot({ path: `${OUT}\\${file}` });
  console.log('shot', file);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  // Rifero demo (con plan + rifa)
  let page = await browser.newPage();
  await login(page, 'demo@bismark.com', 'Demo1234!');
  await shot(page, '/panel', 'bsk-panel-demo.png');
  await shot(page, '/panel/admin/diseno', 'bsk-panel-diseno.png');
  await shot(page, '/panel/admin/inicio', 'bsk-panel-inicio.png');
  await page.close();

  // Rifero sin plan (vista previa + vacío) — mobile
  page = await browser.newPage();
  await login(page, 'sinplan2@test.com', 'Test1234!');
  await shot(page, '/panel', 'bsk-panel-empty.png', 1340, 900);
  await shot(page, '/panel', 'bsk-panel-empty-mobile.png', 400, 800);
  await page.close();
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const ctx = (await browser.createBrowserContext?.()) || browser;
  const page = await ctx.newPage();
  await page.setViewport({ width: 1340, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.type('#email', 'sinplan2@test.com');
  await page.type('#password', 'Test1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel'), { timeout: 15000 }).catch(() => {});
  await sleep(2800);
  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: `${OUT}\\bsk-panel-empty.png` });
  console.log('shot empty desktop, url=', page.url());

  await page.setViewport({ width: 400, height: 820, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}\\bsk-panel-empty-mobile.png` });
  console.log('shot empty mobile');
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

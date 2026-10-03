import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 1700, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.type('#email', 'demo@bismark.com');
  await page.type('#password', 'Demo1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel'), { timeout: 15000 }).catch(() => {});
  await sleep(3500);
  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.screenshot({ path: `${OUT}\\bsk-panel-new.png` });
  console.log('shot /panel ok, url=', page.url());
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

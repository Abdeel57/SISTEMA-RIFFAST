// Captura el BrandLoader REAL (app construida) durante la carga de /r/rifasdelasuerte.
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:4198/r/rifasdelasuerte';
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 800, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(900); // chunk cargado; query a la API colgada → BrandLoader visible
  for (let i = 1; i <= 4; i++) {
    await page.screenshot({ path: `${OUT}\\bsk-real-${i}.png` });
    await sleep(240);
  }
  console.log('OK ->', `${OUT}\\bsk-real-{1..4}.png`);
} finally {
  await browser.close();
}

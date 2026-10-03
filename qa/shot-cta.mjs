import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(resolve('qa/bismark-cta-preview.html')).href;
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });
  await page.goto(FILE, { waitUntil: 'networkidle2' });
  await sleep(2500); // fuentes + Tailwind CDN
  // Recorta hasta el final de la banda (último <section>) para una imagen limpia.
  const h = await page.evaluate(() => Math.ceil(document.querySelector('section').getBoundingClientRect().bottom));
  await page.screenshot({ path: `${OUT}\\bsk-cta.png`, clip: { x: 0, y: 0, width: 440, height: h } });
  console.log('OK ->', `${OUT}\\bsk-cta.png`);
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

// Captura el BrandLoader en 3 momentos del barrido para verificar el destello.
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(resolve('qa/brandloader-preview.html')).href;
const OUT = process.env.TEMP || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 480, deviceScaleFactor: 2 });
  await page.goto(FILE, { waitUntil: 'networkidle2' });
  await sleep(400);
  for (let i = 1; i <= 3; i++) {
    await page.screenshot({ path: `${OUT}\\bsk-loader-${i}.png` });
    await sleep(310); // distintas fases del barrido (ciclo 1.9s)
  }
  console.log('OK ->', `${OUT}\\bsk-loader-{1,2,3}.png`);
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}

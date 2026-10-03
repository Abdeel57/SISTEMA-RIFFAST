// QA UI — recorre las páginas clave con Chrome headless y reporta errores de
// consola, excepciones y peticiones fallidas. Ejercita además los flujos:
// login → panel, registro → onboarding y selección de boleto en la página pública.
// Requiere web dev (5173) y API (4000) corriendo. Uso: node qa/ui-check.mjs
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SUF = Date.now().toString(36).slice(-6);

let pass = 0, fail = 0;
const ok = (n, e = '') => (pass++, console.log(`✅ ${n}${e ? '  · ' + e : ''}`));
const bad = (n, e = '') => (fail++, console.log(`❌ ${n}${e ? '  · ' + e : ''}`));

// Ruido aceptable (no son fallas de la app).
const IGNORE = [
  /posthog/i, // analytics sin clave en dev
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /sw\.js|workbox|service.?worker/i, // PWA en dev
  /chrome-extension/i,
];
const noise = (t) => IGNORE.some((re) => re.test(t));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 414, height: 900, deviceScaleFactor: 1 });

const issues = [];
page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) issues.push(`console: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => { if (!noise(e.message)) issues.push(`pageerror: ${e.message.slice(0, 200)}`); });
page.on('requestfailed', (r) => { if (!noise(r.url())) issues.push(`reqfail: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`); });
page.on('response', (r) => {
  if (r.status() >= 500 && !noise(r.url())) issues.push(`http${r.status()}: ${r.url().slice(0, 120)}`);
});

async function visit(name, url, checkFn) {
  issues.length = 0;
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(900);
    const extra = checkFn ? await checkFn() : null;
    if (extra === false) return bad(`${name} (contenido)`, 'la verificación de contenido falló');
    if (issues.length) return bad(name, issues.slice(0, 3).join(' | '));
    ok(name, extra || undefined);
  } catch (e) {
    bad(name, e.message.slice(0, 150));
  }
}

console.log(`\n🖥️  Bismark UI check → ${BASE}\n`);

// ── Páginas públicas ──
await visit('Landing /', '/', async () => {
  const t = await page.$eval('h1', (el) => el.textContent).catch(() => '');
  return /rifas/i.test(t) ? `h1 ok` : false;
});

await visit('Perfil público /r/rifasdelasuerte', '/r/rifasdelasuerte', async () => {
  const html = await page.content();
  return /Rifas de la Suerte/i.test(html) ? 'nombre del rifero visible' : false;
});

await visit('Rifa pública E1 + selección de boleto', '/r/rifasdelasuerte/e1', async () => {
  // La cuadrícula de boletos: botones numerados. Selecciona el primero disponible.
  await page.waitForSelector('button', { timeout: 10000 });
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => /^\d{2,6}$/.test(b.textContent.trim()) && !b.disabled);
    if (!btns.length) return false;
    btns[0].click();
    return true;
  });
  if (!clicked) return false;
  await new Promise((r) => setTimeout(r, 700));
  // Debe aparecer el panel de selección (botón de continuar/apartar).
  const panel = await page.evaluate(() => /apartar|continuar|boleto/i.test(document.body.innerText));
  return panel ? 'boleto seleccionado, panel visible' : false;
});

await visit('Verificador /r/rifasdelasuerte/verificar', '/r/rifasdelasuerte/verificar', async () => {
  const html = await page.content();
  return /tel[eé]fono|boletos/i.test(html) ? 'formulario visible' : false;
});

await visit('Planes /planes', '/planes', async () => {
  const html = await page.content();
  return /plan/i.test(html) ? 'planes visibles' : false;
});

// ── Login → panel del rifero ──
issues.length = 0;
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email', { timeout: 10000 });
  await page.type('#email', 'demo@bismark.com');
  await page.type('#password', 'Demo1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/panel') || location.pathname.startsWith('/dashboard'), { timeout: 15000 });
  await sleep(2200);
  const realIssues = issues.filter((i) => !noise(i));
  if (realIssues.length) bad('Login demo → panel', realIssues.slice(0, 3).join(' | '));
  else ok('Login demo → panel', page.url().replace(BASE, ''));
} catch (e) {
  bad('Login demo → panel', e.message.slice(0, 150));
}

// Panel: secciones principales del administrador del rifero.
for (const [name, path, re] of [
  ['Panel · Rifas', '/panel/admin/rifas', /rifa/i],
  ['Panel · Órdenes', '/panel/admin/ordenes', /orden|folio/i],
  ['Panel · Apariencia', '/panel/admin/apariencia', /logo|color|portada/i],
  ['Panel · Métodos de pago', '/panel/admin/pagos', /pago|banco|cuenta/i],
]) {
  await visit(name, path, async () => {
    const html = await page.content();
    return re.test(html) ? 'render ok' : false;
  });
}

// ── Registro de cuenta nueva → onboarding ──
issues.length = 0;
try {
  // Cierra la sesión demo: /registro redirige si ya hay sesión.
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.clearBrowserCookies');
  await page.goto(`${BASE}/registro`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input', { timeout: 10000 });
  // Campos por orden: nombre, email, teléfono, contraseña, confirmación (ids pueden variar).
  const typed = await page.evaluate((suf) => {
    const ins = [...document.querySelectorAll('input')];
    const byType = (t) => ins.filter((i) => i.type === t);
    const set = (el, v) => { if (!el) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true; };
    const okName = set(ins.find((i) => i.type === 'text'), 'QA UI Tester');
    const okMail = set(byType('email')[0], `qa-ui-${suf}@test.local`);
    const okTel = set(byType('tel')[0] ?? ins.filter((i) => i.type === 'text')[1], '5522334455');
    const pws = byType('password');
    const okPw = set(pws[0], 'Prueba1234!') && set(pws[1] ?? pws[0], 'Prueba1234!');
    const chk = ins.find((i) => i.type === 'checkbox');
    if (chk && !chk.checked) chk.click();
    return okName && okMail && okTel && okPw;
  }, SUF);
  if (!typed) throw new Error('no pude llenar el formulario de registro');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => /onboarding|bienvenida|perfil|panel/i.test(location.pathname + document.body.innerText), { timeout: 15000 });
  await sleep(1200);
  const realIssues = issues.filter((i) => !noise(i));
  if (realIssues.length) bad('Registro → onboarding', realIssues.slice(0, 3).join(' | '));
  else ok('Registro → onboarding', page.url().replace(BASE, ''));
} catch (e) {
  bad('Registro → onboarding', e.message.slice(0, 150));
}

// ── Super admin ──
issues.length = 0;
try {
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.clearBrowserCookies');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email', { timeout: 10000 });
  await page.type('#email', 'admin@bismark.com');
  await page.type('#password', 'Admin1234!');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
  await sleep(2000);
  const where = page.url().replace(BASE, '');
  const html = await page.content();
  const looksAdmin = /super|admin|m[ée]tricas|riferos/i.test(html);
  const realIssues = issues.filter((i) => !noise(i));
  if (realIssues.length) bad('Login super admin', realIssues.slice(0, 3).join(' | '));
  else if (!looksAdmin) bad('Login super admin', `no parece el panel admin: ${where}`);
  else ok('Login super admin', where);
} catch (e) {
  bad('Login super admin', e.message.slice(0, 150));
}

await browser.close();
console.log(`\n── Resumen UI: ${pass} ok · ${fail} fallos ──\n`);
process.exit(fail > 0 ? 1 : 0);

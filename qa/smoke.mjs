// QA smoke — verifica la integración contra el API vivo (http://localhost:4000).
// Solo lectura + auth (no muta datos). Uso: node qa/smoke.mjs
const BASE = process.env.API_URL || 'http://localhost:4000';
const RIFERO = { email: 'demo@bismark.com', password: 'Demo1234!' };
const ADMIN = { email: 'admin@bismark.com', password: 'Admin1234!' };

let pass = 0,
  fail = 0,
  warn = 0;
const log = (icon, name, extra = '') => console.log(`${icon} ${name}${extra ? '  · ' + extra : ''}`);
const ok = (n, e) => (pass++, log('✅', n, e));
const bad = (n, e) => (fail++, log('❌', n, e));
const pend = (n, e) => (warn++, log('🟡', n, e));

async function req(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data, setCookie };
}
function sessionFrom(setCookie) {
  const c = setCookie.find((x) => x.startsWith('bsk_session='));
  return c ? c.split(';')[0] : '';
}

async function main() {
  console.log(`\n🔎 Bismark QA smoke → ${BASE}\n`);

  // ── Salud + público ──
  try {
    const r = await req('/health');
    r.status === 200 && r.data?.ok ? ok('GET /health') : bad('GET /health', `status ${r.status}`);
  } catch (e) { bad('GET /health', e.message); }

  try {
    const r = await req('/plans');
    Array.isArray(r.data?.items) && r.data.items.length ? ok('GET /plans', `${r.data.items.length} planes`) : bad('GET /plans', `status ${r.status}`);
  } catch (e) { bad('GET /plans', e.message); }

  try {
    const r = await req('/public/riferos/by-subdomain/rifasdelasuerte');
    r.data?.active === true ? ok('GET público rifero (rifasdelasuerte)') : bad('GET público rifero', `active=${r.data?.active}`);
  } catch (e) { bad('GET público rifero', e.message); }

  try {
    const r = await req('/public/raffles/by-event/rifasdelasuerte/1');
    r.data?.active === true ? ok('GET público rifa E1') : bad('GET público rifa E1', `active=${r.data?.active}`);
  } catch (e) { bad('GET público rifa E1', e.message); }

  // ── Seguridad ──
  try {
    const r = await req('/orders');
    r.status === 401 ? ok('GET /orders sin sesión → 401') : bad('GET /orders sin sesión', `esperaba 401, got ${r.status}`);
  } catch (e) { bad('GET /orders sin sesión', e.message); }

  // ── Auth rifero ──
  let riferoCookie = '';
  try {
    const r = await req('/auth/login', { method: 'POST', body: RIFERO });
    riferoCookie = sessionFrom(r.setCookie);
    r.status === 200 && riferoCookie ? ok('POST /auth/login (rifero)') : bad('POST /auth/login (rifero)', `status ${r.status}`);
  } catch (e) { bad('POST /auth/login (rifero)', e.message); }

  // ── Feature: badge de órdenes (otra sesión) ──
  try {
    const r = await req('/orders/pending-count', { cookie: riferoCookie });
    typeof r.data?.count === 'number' ? ok('GET /orders/pending-count', `count=${r.data.count}`) : pend('GET /orders/pending-count', `status ${r.status} (¿en curso?)`);
  } catch (e) { pend('GET /orders/pending-count', e.message); }

  // ── Feature: notificaciones (otra sesión) ──
  try {
    const r = await req('/notifications/summary', { cookie: riferoCookie });
    r.status === 200 && r.data ? ok('GET /notifications/summary', JSON.stringify(r.data)) : pend('GET /notifications/summary', `status ${r.status} (¿en curso?)`);
  } catch (e) { pend('GET /notifications/summary', e.message); }

  // ── Feature: recuperación de contraseña (otra sesión) ──
  try {
    const r = await req('/auth/forgot-password', { method: 'POST', body: { email: RIFERO.email } });
    r.status === 200 && r.data?.ok ? ok('POST /auth/forgot-password → 200') : bad('POST /auth/forgot-password', `status ${r.status}`);
  } catch (e) { bad('POST /auth/forgot-password', e.message); }

  try {
    const r = await req('/auth/reset-password', { method: 'POST', body: { token: 'token-invalido-de-prueba-xxxxxxxx', password: 'NuevaClave1', confirmPassword: 'NuevaClave1' } });
    r.status === 400 ? ok('POST /auth/reset-password (token inválido → 400)') : bad('POST /auth/reset-password', `esperaba 400, got ${r.status}`);
  } catch (e) { bad('POST /auth/reset-password', e.message); }

  // ── Feature: Open Graph dinámico (otra sesión) ──
  try {
    const r = await req('/s/r/rifasdelasuerte');
    if (r.status === 200 && typeof r.data === 'string' && /og:title|property="og:/.test(r.data)) ok('GET /s/r/:slug (OG)');
    else pend('GET /s/r/:slug (OG)', `status ${r.status} (¿en curso?)`);
  } catch (e) { pend('GET /s/r/:slug (OG)', e.message); }

  // ── Auth admin + métricas ──
  try {
    const r = await req('/auth/login', { method: 'POST', body: ADMIN });
    const adminCookie = sessionFrom(r.setCookie);
    if (r.status !== 200 || !adminCookie) bad('POST /auth/login (admin)', `status ${r.status}`);
    else {
      ok('POST /auth/login (admin)');
      const m = await req('/admin/metrics', { cookie: adminCookie });
      m.status === 200 && m.data?.metrics ? ok('GET /admin/metrics', `riferos=${m.data.metrics.totalRiferos}`) : bad('GET /admin/metrics', `status ${m.status}`);
      // ownership: rifero NO debe ver métricas admin
      const forbidden = await req('/admin/metrics', { cookie: riferoCookie });
      forbidden.status === 403 ? ok('Rifero → /admin/metrics → 403 (aislamiento)') : bad('aislamiento de rol', `got ${forbidden.status}`);
    }
  } catch (e) { bad('admin flow', e.message); }

  console.log(`\n── Resumen: ${pass} ok · ${warn} pendientes · ${fail} fallos ──\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke crashed:', e); process.exit(1); });

// Verifica el modelo "sin plan": una cuenta SIN plan activo debe poder
// CREAR rifas (201) y NO poder PUBLICAR (402). Uso: node qa/diag-noplan-create.mjs
const BASE = process.env.API_URL || 'http://localhost:4000';
const ts = Date.now();
const email = `noplan${ts}@bismark.test`;
const slug = `np${ts}`;
const pass = 'Demo1234!';

let cookie = '';
async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const c = setCookie.find((x) => x.startsWith('bsk_session='));
  if (c) cookie = c.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data };
}

const j = (d) => JSON.stringify(d)?.slice(0, 160);

(async () => {
  let r = await req('/auth/register', {
    method: 'POST',
    body: { name: 'No Plan', email, phone: '5512345678', password: pass, confirmPassword: pass, acceptTerms: true },
  });
  console.log(`register      -> ${r.status}  cookie=${cookie ? 'sí' : 'no'}`);

  r = await req('/riferos/onboarding', {
    method: 'POST',
    body: { fullName: 'No Plan', email, phone: '5512345678', publicName: 'Rifas Sin Plan', slug, whatsapp: '5512345678' },
  });
  console.log(`onboarding    -> ${r.status}  ${r.status >= 400 ? j(r.data) : ''}`);

  r = await req('/riferos/me');
  console.log(`riferos/me    -> ${r.status}  hasActivePlan=${r.data?.profile?.hasActivePlan}`);

  // 1) Crear rifa SIN plan  → esperado 201
  r = await req('/raffles', {
    method: 'POST',
    body: { title: 'Rifa sin plan', prize: 'Premio', ticketPrice: 50, totalTickets: 100, ticketFormat: 3, ticketStart: 1 },
  });
  const raffleId = r.data?.raffle?.id;
  console.log(`POST /raffles -> ${r.status}  ${r.status === 201 ? '✅ crea sin plan' : '❌ ' + j(r.data)}`);

  // 2) Publicar SIN plan  → esperado 402
  if (raffleId) {
    r = await req(`/raffles/${raffleId}/publish`, { method: 'POST' });
    console.log(`publish       -> ${r.status}  ${r.status === 402 ? '✅ publicar sigue gateado' : '❌ ' + j(r.data)}`);
  }

  // 3) El público debe ver "no activa" (active:false)
  r = await req(`/public/riferos/by-subdomain/${slug}`);
  console.log(`público       -> active=${r.data?.active}  ${r.data?.active === false ? '✅ Próximamente' : '❌'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

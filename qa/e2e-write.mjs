// QA E2E de escritura — ejercita el ciclo de vida completo contra el API local:
// registro → onboarding → crear rifa → gating de plan → activación (admin) →
// publicar → compra pública (reservar/duplicado/comprobante) → confirmar pago →
// boleto digital (JSON/PDF/validar) → tómbola → aislamiento entre riferos →
// suspensión/reactivación. Crea datos con prefijo qa-e2e (no toca los demo).
// Uso: node qa/e2e-write.mjs
const BASE = process.env.API_URL || 'http://localhost:4000';
const ADMIN = { email: 'admin@bismark.com', password: 'Admin1234!' };
const DEMO = { email: 'demo@bismark.com', password: 'Demo1234!' };

const SUF = Date.now().toString(36).slice(-6);
const EMAIL = `qa-e2e-${SUF}@test.local`;
const SLUG = `qa-e2e-${SUF}`;
const PASS = 'Prueba1234!';

let pass = 0, fail = 0;
const ok = (n, e = '') => (pass++, console.log(`✅ ${n}${e ? '  · ' + e : ''}`));
const bad = (n, e = '') => (fail++, console.log(`❌ ${n}${e ? '  · ' + e : ''}`));
const expect = (cond, name, extra = '') => (cond ? ok(name, extra) : bad(name, extra));

async function req(path, { method = 'GET', body, cookie, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.arrayBuffer();
  return { status: res.status, data, setCookie, ct };
}
const cookieOf = (sc) => (sc.find((x) => x.startsWith('bsk_session=')) || '').split(';')[0];

// PNG 1×1 transparente para subir como comprobante.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  console.log(`\n🧪 Bismark E2E write → ${BASE}  (sufijo ${SUF})\n`);

  // ── 1. Registro ──
  let cookie = '';
  {
    const r = await req('/auth/register', {
      method: 'POST',
      body: { name: 'QA Tester', email: EMAIL, phone: '5511223344', password: PASS, confirmPassword: PASS, acceptTerms: true },
    });
    cookie = cookieOf(r.setCookie);
    expect(r.status === 201 && !!cookie, 'POST /auth/register (201 + sesión)', `status ${r.status}`);

    const dup = await req('/auth/register', {
      method: 'POST',
      body: { name: 'QA Tester', email: EMAIL, phone: '5511223344', password: PASS, confirmPassword: PASS, acceptTerms: true },
    });
    expect(dup.status === 409, 'Registro duplicado → 409', `status ${dup.status}`);

    const badLogin = await req('/auth/login', { method: 'POST', body: { email: EMAIL, password: 'Incorrecta1!' } });
    expect(badLogin.status === 401, 'Login con contraseña errada → 401', `status ${badLogin.status}`);
  }

  // ── 2. Onboarding (perfil de rifero) ──
  let riferoId = '';
  {
    const chk = await req(`/riferos/check-slug?slug=${SLUG}`, { cookie });
    expect(chk.status === 200 && chk.data?.available === true, 'GET /riferos/check-slug (disponible)', `status ${chk.status}`);

    const r = await req('/riferos/onboarding', {
      method: 'POST',
      cookie,
      body: {
        fullName: 'QA Tester', email: EMAIL, phone: '5511223344',
        publicName: `Rifas QA ${SUF}`, slug: SLUG, whatsapp: '5511223344',
        description: 'Perfil de prueba E2E', primaryColor: '#1A4DFF', secondaryColor: '#0F1116',
      },
    });
    riferoId = r.data?.rifero?.id ?? r.data?.profile?.id ?? '';
    // El onboarding puede rotar la sesión (ya con riferoId); usa la nueva cookie si llega.
    const c2 = cookieOf(r.setCookie);
    if (c2) cookie = c2;
    expect((r.status === 200 || r.status === 201) && !!riferoId, 'POST /riferos/onboarding', `status ${r.status} id=${riferoId || '—'}`);

    const me = await req('/auth/me', { cookie });
    expect(me.status === 200 && me.data?.user?.slug === SLUG, 'GET /auth/me refleja el perfil', `slug=${me.data?.user?.slug}`);
  }

  // ── 3. Crear rifa (borrador) y gating de plan ──
  let raffleId = '';
  let eventNumber = 0;
  {
    const r = await req('/raffles', {
      method: 'POST',
      cookie,
      body: { title: `Rifa QA ${SUF}`, prize: 'Premio de prueba', ticketPrice: 100, totalTickets: 50, ticketFormat: 3, ticketStart: 1 },
    });
    raffleId = r.data?.raffle?.id ?? '';
    eventNumber = r.data?.raffle?.eventNumber ?? 0;
    expect((r.status === 200 || r.status === 201) && !!raffleId, 'POST /raffles (borrador)', `status ${r.status} E${eventNumber}`);

    const pub = await req(`/raffles/${raffleId}/publish`, { method: 'POST', cookie });
    expect(pub.status === 402 || pub.status === 403 || pub.status === 400, 'Publicar SIN plan → bloqueado', `status ${pub.status}`);

    const pubReserve = await req(`/public/raffles/${raffleId}/reserve`, {
      method: 'POST',
      body: { buyer: { fullName: 'Comprador X', phone: '5599887766' }, ticketNumbers: [1] },
    });
    expect(pubReserve.status === 403 || pubReserve.status === 404, 'Reservar en rifa NO publicada → bloqueado', `status ${pubReserve.status}`);
  }

  // ── 4. Admin activa plan Pro al rifero nuevo ──
  let adminCookie = '';
  {
    const login = await req('/auth/login', { method: 'POST', body: ADMIN });
    adminCookie = cookieOf(login.setCookie);
    expect(login.status === 200 && !!adminCookie, 'Login admin', `status ${login.status}`);

    const plans = await req('/plans');
    const pro = (plans.data?.items ?? []).find((p) => p.slug === 'pro');
    expect(!!pro, 'Plan pro disponible', pro ? pro.id : 'no encontrado');

    const act = await req('/admin/subscriptions/activate', {
      method: 'POST',
      cookie: adminCookie,
      body: { riferoId, planId: pro?.id ?? '', months: 1 },
    });
    expect(act.status === 200 || act.status === 201, 'POST /admin/subscriptions/activate (pro)', `status ${act.status}`);
  }

  // ── 5. Publicar y página pública activa ──
  {
    const pub = await req(`/raffles/${raffleId}/publish`, { method: 'POST', cookie });
    expect(pub.status === 200 && pub.data?.raffle?.status === 'PUBLISHED', 'Publicar CON plan → PUBLISHED', `status ${pub.status}`);

    const site = await req(`/public/riferos/by-subdomain/${SLUG}`);
    expect(site.status === 200 && site.data?.active === true, 'Página pública activa', `raffles=${site.data?.rifero?.raffles?.length}`);

    // Habilita comprobantes en el perfil (el plan pro lo permite; el perfil arranca en false).
    const patch = await req('/riferos/me', { method: 'PATCH', cookie, body: { allowProofUpload: true } });
    expect(patch.status === 200, 'PATCH /riferos/me (allowProofUpload=true)', `status ${patch.status}`);
  }

  // ── 6. Compra pública: reservar boletos ──
  let orderCode = '';
  {
    const r = await req(`/public/raffles/${raffleId}/reserve`, {
      method: 'POST',
      body: { buyer: { fullName: 'COMPRADOR QA', phone: '5599887766', whatsapp: '5599887766', state: 'JALISCO' }, ticketNumbers: [7, 8, 9] },
    });
    orderCode = r.data?.receipt?.code ?? r.data?.order?.code ?? '';
    expect((r.status === 200 || r.status === 201) && !!orderCode, 'Reservar boletos 7,8,9', `status ${r.status} code=${orderCode}`);
    const total = r.data?.receipt?.totalAmount ?? r.data?.order?.totalAmount;
    expect(total === 300, 'Total correcto (3 × $100)', `total=${total}`);

    const dupRes = await req(`/public/raffles/${raffleId}/reserve`, {
      method: 'POST',
      body: { buyer: { fullName: 'OTRO COMPRADOR', phone: '5511112222' }, ticketNumbers: [8] },
    });
    expect(dupRes.status === 409, 'Boleto ya reservado → 409', `status ${dupRes.status}`);

    const range = await req(`/public/raffles/${raffleId}/reserve`, {
      method: 'POST',
      body: { buyer: { fullName: 'FUERA DE RANGO', phone: '5511113333' }, ticketNumbers: [9999] },
    });
    expect(range.status === 400, 'Boleto fuera de rango → 400', `status ${range.status}`);

    const grid = await req(`/public/raffles/${raffleId}/tickets`);
    const reserved = (grid.data?.items ?? []).filter((t) => t.status !== 'AVAILABLE').length;
    expect(reserved === 3, 'Cuadrícula refleja 3 reservados', `no-disponibles=${reserved}`);

    // Orden GRANDE (40 boletos): el recibo supera 1 KB y viaja comprimido (gzip).
    // Regresión del bug reply.send-sin-return + @fastify/compress (cuerpo vacío).
    const big = await req(`/public/raffles/${raffleId}/reserve`, {
      method: 'POST',
      body: {
        buyer: { fullName: 'COMPRADOR MAYOREO', phone: '5544455566' },
        ticketNumbers: Array.from({ length: 40 }, (_, i) => i + 10),
      },
    });
    const bigCount = big.data?.receipt?.ticketNumbers?.length ?? 0;
    expect(big.status === 201 && bigCount === 40, 'Reserva grande (40 boletos, recibo >1KB gzip)', `status ${big.status} tickets=${bigCount}`);
  }

  // ── 7. Lookup del comprador + comprobante ──
  {
    const look = await req('/public/orders/lookup', { method: 'POST', body: { slug: SLUG, phone: '5599887766' } });
    const o = (look.data?.orders ?? [])[0];
    expect(!!o && o.code === orderCode && o.status === 'RESERVED', 'Lookup por teléfono (RESERVED)', `status=${o?.status}`);
    expect(o?.digitalTicketCode == null, 'Sin boleto digital antes de pagar', String(o?.digitalTicketCode));

    const fd = new FormData();
    fd.append('file', new Blob([PNG], { type: 'image/png' }), 'comprobante.png');
    fd.append('method', 'TRANSFER');
    const up = await req(`/public/orders/${orderCode}/proof`, { method: 'POST', body: fd, raw: true });
    expect(up.status === 201, 'Subir comprobante (PNG) → 201', `status ${up.status}`);

    const look2 = await req('/public/orders/lookup', { method: 'POST', body: { slug: SLUG, phone: '5599887766' } });
    const o2 = (look2.data?.orders ?? [])[0];
    expect(o2?.status === 'PENDING' && o2?.hasProof === true, 'Orden pasa a PENDING con comprobante', `status=${o2?.status} hasProof=${o2?.hasProof}`);
  }

  // ── 8. Rifero: ver orden, comprobante y confirmar pago ──
  let orderId = '';
  let digitalCode = '';
  {
    const orders = await req('/orders', { cookie });
    const o = (orders.data?.items ?? []).find((x) => x.code === orderCode);
    orderId = o?.id ?? '';
    expect(!!orderId, 'GET /orders muestra la orden', `status=${o?.status}`);

    const proofs = await req(`/orders/${orderId}/proof`, { cookie });
    expect(proofs.status === 200 && (proofs.data?.items ?? []).length === 1, 'GET /orders/:id/proof (1 comprobante)', `n=${proofs.data?.items?.length}`);

    // Aislamiento: el rifero demo NO debe ver esta orden.
    const demoLogin = await req('/auth/login', { method: 'POST', body: DEMO });
    const demoCookie = cookieOf(demoLogin.setCookie);
    const leak = await req(`/orders/${orderId}`, { cookie: demoCookie });
    expect(leak.status === 403 || leak.status === 404, 'Aislamiento: otro rifero no ve la orden', `status ${leak.status}`);

    const paid = await req(`/orders/${orderId}/mark-paid`, { method: 'PATCH', cookie });
    expect(paid.status === 200 && paid.data?.order?.status === 'PAID', 'PATCH mark-paid → PAID', `status ${paid.status}`);

    const again = await req(`/orders/${orderId}/mark-paid`, { method: 'PATCH', cookie });
    expect(again.status === 409, 'mark-paid dos veces → 409', `status ${again.status}`);

    const look = await req('/public/orders/lookup', { method: 'POST', body: { slug: SLUG, phone: '5599887766' } });
    const o3 = (look.data?.orders ?? [])[0];
    digitalCode = o3?.digitalTicketCode ?? '';
    expect(o3?.status === 'PAID' && !!digitalCode, 'Comprador ve PAID + código digital', `code=${digitalCode || '—'}`);
  }

  // ── 9. Boleto digital: JSON, PDF y validación ──
  {
    const t = await req(`/tickets/digital/${digitalCode}`);
    expect(t.status === 200 && (t.data?.ticket?.ticketNumbers?.length === 3 || t.data?.ticket), 'GET boleto digital (JSON)', `status ${t.status}`);

    const pdf = await req(`/tickets/digital/${digitalCode}/pdf`);
    const isPdf = pdf.ct.includes('pdf') && pdf.data?.byteLength > 800;
    expect(pdf.status === 200 && isPdf, 'GET boleto digital PDF', `${pdf.ct} ${pdf.data?.byteLength ?? 0}B`);

    const val = await req(`/validar/${digitalCode}`);
    expect(val.status === 200, 'GET /validar/:code', `status ${val.status}`);

    const bogus = await req('/tickets/digital/NOEXISTE123');
    expect(bogus.status === 404, 'Boleto digital inexistente → 404', `status ${bogus.status}`);
  }

  // ── 10. Tómbola (sorteo digital) ──
  {
    const draw = await req(`/raffles/${raffleId}/draw`, { method: 'POST', cookie, body: { prizes: [{ position: 1, prizeDescription: 'Premio QA' }], allowRepeatWinner: false } });
    const winners = draw.data?.winners ?? [];
    expect(draw.status === 200 && winners.length === 1, 'POST /raffles/:id/draw (1 ganador)', `status ${draw.status} winners=${winners.length}`);
    const winNum = winners[0]?.ticketDisplayNumber;
    expect(['007', '008', '009'].includes(winNum), 'Ganador sale de boletos PAGADOS', `ticket=${winNum}`);

    const list = await req(`/raffles/${raffleId}/winners`, { cookie });
    expect(list.status === 200 && (list.data?.items ?? list.data?.winners ?? []).length >= 1, 'GET /raffles/:id/winners', `status ${list.status}`);
  }

  // ── 11. Suspensión / reactivación (admin) ──
  {
    const sus = await req(`/admin/riferos/${riferoId}/suspend`, { method: 'PATCH', cookie: adminCookie });
    expect(sus.status === 200, 'Admin suspende rifero', `status ${sus.status}`);

    const site = await req(`/public/riferos/by-subdomain/${SLUG}`);
    expect(site.data?.active === false, 'Página pública desactivada al suspender', `active=${site.data?.active}`);

    const re = await req(`/admin/riferos/${riferoId}/reactivate`, { method: 'PATCH', cookie: adminCookie });
    expect(re.status === 200, 'Admin reactiva rifero', `status ${re.status}`);

    const site2 = await req(`/public/riferos/by-subdomain/${SLUG}`);
    expect(site2.data?.active === true, 'Página pública vuelve a activa', `active=${site2.data?.active}`);
  }

  console.log(`\n── Resumen E2E: ${pass} ok · ${fail} fallos ──\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('e2e crashed:', e); process.exit(1); });

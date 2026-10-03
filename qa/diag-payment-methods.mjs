const API = 'http://localhost:4000';
let cookie = '';
async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  const c = sc.find((x) => x.startsWith('bsk_session='));
  if (c) cookie = c.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => null) };
}

(async () => {
  await req('/auth/login', { method: 'POST', body: { email: 'demo@bismark.com', password: 'Demo1234!' } });

  // 1) Guardar 3 métodos (PATCH como lo hace el panel)
  const methods = [
    { id: 'demo-bbva', bank: 'BBVA', holderName: 'Carlos Demo', clabe: '012345678901234567', cardNumber: '4152313800000000', concept: 'Folio de tu orden', instructions: '' },
    { id: 'demo-oxxo', bank: 'OXXO', holderName: 'Carlos Demo', clabe: '', cardNumber: '4766840012345678', concept: 'Folio de tu orden', instructions: 'Deposita en cualquier OXXO con el número de tarjeta.' },
    { id: 'demo-nu', bank: 'Nu', holderName: 'Carlos Demo', clabe: '638180000012345678', cardNumber: '', concept: '', instructions: '' },
  ];
  const patch = await req('/riferos/me', { method: 'PATCH', body: { paymentMethods: methods, payBank: 'BBVA', payHolderName: 'Carlos Demo' } });
  console.log(`PATCH /riferos/me → ${patch.status} · métodos guardados: ${patch.data?.profile?.paymentMethods?.length ?? '∅'}`);

  // 2) Payload público de la rifa incluye methods
  const pub = await req('/public/raffles/by-event/rifasdelasuerte/2');
  const pm = pub.data?.raffle?.paymentProfile?.methods;
  console.log(`público rifa → methods: ${pm?.length ?? '∅'} (${(pm ?? []).map((m) => m.bank).join(', ')})`);

  // 3) Lookup incluye methods
  const lk = await req('/public/orders/lookup', { method: 'POST', body: { slug: 'rifasdelasuerte', phone: '5511223344' } });
  console.log(`lookup → methods: ${lk.data?.paymentProfile?.methods?.length ?? '∅'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

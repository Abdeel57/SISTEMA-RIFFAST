import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { AiClient, AiStatus } from '../ai/client.js';
import { AiError } from '../ai/http.js';
import type { ChatInput } from '../ai/types.js';
import { TECHNICAL_ERROR } from '../api.js';
import { createAlertThrottle } from '../notify.js';
import { AI_DOWN_TEXT, AssistantHttpError, CANCEL_TEXT, createAssistantService, LIMIT_TEXT } from '../service.js';
import type { AssistantSettings } from '../settings.js';
import { ADMIN, SELLER, calls, fakeAi, fakeApi, memoryStore, recordingNotifier, seedAccount, silentLog, testSettings, text } from './helpers.js';

const SITE = 'https://rifasana.com';

function setup(opts: { ai?: AiClient | null; aiError?: AiError; settings?: Partial<AssistantSettings> } = {}) {
  let t = new Date('2026-10-03T18:00:00Z');
  const clock = () => t;
  const store = memoryStore(clock);
  seedAccount(store);
  const notifier = recordingNotifier();
  const status: AiStatus =
    opts.ai === null
      ? { configured: false, client: null, error: null }
      : opts.aiError
        ? { configured: true, client: null, error: opts.aiError }
        : { configured: true, client: opts.ai ?? fakeAi([text('hola')]), error: null };
  const service = createAssistantService({
    store,
    ai: () => status,
    notifier,
    settings: () => testSettings(opts.settings),
    log: silentLog,
    now: clock,
    throttle: createAlertThrottle(60 * 60_000, () => t.getTime()),
  });
  return {
    store,
    notifier,
    service,
    advance: (ms: number) => {
      t = new Date(t.getTime() + ms);
    },
  };
}

const req = (auth: typeof ADMIN | typeof SELLER, api = fakeApi({})) => ({ auth, api, siteUrl: SITE });

const RIFA_ARGS = {
  titulo: 'Rifa de Italika FT150',
  premio: 'Moto Italika FT150',
  precio_boleto: 50,
  total_boletos: 500,
  fecha_sorteo: '2026-11-30T20:00',
};

// Último resultado de herramienta que vio la IA.
function lastToolResult(input: ChatInput): Record<string, unknown> {
  const tool = [...input.messages].reverse().find((m) => m.role === 'tool');
  return tool && tool.role === 'tool' ? JSON.parse(tool.content) : {};
}

describe('servicio: estado y límites', () => {
  test('sin clave → inactivo', async () => {
    const { service } = setup({ ai: null });
    const r = await service.mensaje(req(ADMIN), { texto: 'hola' });
    assert.equal(r.estado, 'inactivo');
    const e = await service.estado(ADMIN);
    assert.equal(e.activo, false);
  });

  test('sugerencias según el rol y teléfono por defecto', async () => {
    const { service } = setup();
    const a = await service.estado(ADMIN);
    assert.equal(a.activo, true);
    assert.ok(a.sugerencias.includes('Crear una rifa'));
    assert.equal(a.telefono, '6621234567');
    const s = await service.estado(SELLER);
    assert.ok(s.sugerencias.includes('¿Cuánto llevo vendido?'));
    assert.ok(!s.sugerencias.includes('Crear una rifa'));
  });

  test('mensaje inválido', async () => {
    const { service } = setup();
    assert.equal((await service.mensaje(req(ADMIN), { texto: '' })).estado, 'invalido');
    assert.equal((await service.mensaje(req(ADMIN), { texto: 'x'.repeat(2001) })).estado, 'invalido');
    const img = { mimeType: 'image/gif', data: 'AAAA' };
    assert.equal((await service.mensaje(req(ADMIN), { texto: 'x', imagenes: [img] })).estado, 'invalido');
    const ok = { mimeType: 'image/jpeg', data: 'AAAA' };
    assert.equal((await service.mensaje(req(ADMIN), { texto: 'x', imagenes: [ok, ok, ok] })).estado, 'invalido');
  });

  test('límite diario por cuenta', async () => {
    const { service } = setup({ settings: { limiteDiario: 2 } });
    assert.equal((await service.mensaje(req(ADMIN), { texto: 'uno' })).estado, 'ok');
    assert.equal((await service.mensaje(req(SELLER), { texto: 'dos' })).estado, 'ok');
    const r = await service.mensaje(req(ADMIN), { texto: 'tres' });
    assert.equal(r.estado, 'limite');
    assert.equal(r.texto, LIMIT_TEXT);
    assert.equal(r.permitirLlamada, true);
  });

  test('las imágenes no se guardan en la BD', async () => {
    const ai = fakeAi([text('Leí tu tarjeta')]);
    const { service, store } = setup({ ai });
    await service.mensaje(req(ADMIN), { texto: 'agrega esta', imagenes: [{ mimeType: 'image/jpeg', data: 'QUJD' }] });
    const user = store.messages.find((m) => m.message.role === 'user')!.message;
    assert.equal(user.role === 'user' && user.content, 'agrega esta\n[Adjuntó 1 imagen]');
    assert.equal(user.role === 'user' && user.images, undefined);
    // A la IA sí le llegó la imagen.
    const sent = ai.inputs[0].messages.at(-1)!;
    assert.equal(sent.role === 'user' && sent.images?.length, 1);
  });
});

describe('servicio: confirmaciones', () => {
  test('crear rifa: tarjeta, se confirma una sola vez y deja enlace', async () => {
    let seen: Record<string, unknown> = {};
    const ai = fakeAi([
      calls({ name: 'crear_rifa', args: RIFA_ARGS }),
      (input) => {
        seen = lastToolResult(input);
        return text('Revisa los datos en la tarjeta y toca **Confirmar**.');
      },
    ]);
    const { service, store } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'rifa de moto', zonaHoraria: 'America/Mexico_City' });
    assert.equal(r.estado, 'ok');
    assert.equal(seen.estado, 'esperando_confirmacion');
    assert.match(String(seen.nota), /Todavía NO está hecho/);
    assert.equal(r.acciones.length, 1);
    const card = r.acciones[0].tarjeta;
    assert.ok(card.campos.some((c) => c.valor === 'lunes, 30 de noviembre de 2026, 20:00'));
    assert.ok(card.campos.some((c) => c.valor === '$50 MXN' && c.destacado));
    assert.equal(store.actions[0].status, 'pendiente');

    const api = fakeApi({
      'POST /raffles': () => ({ status: 201, body: { raffle: { id: 'r9', title: RIFA_ARGS.titulo, eventNumber: 3 } } }),
    });
    const [a, b] = await Promise.all([
      service.confirmar(req(ADMIN, api), r.acciones[0].id, {}),
      service.confirmar(req(ADMIN, api), r.acciones[0].id, {}),
    ]);
    assert.equal(api.calls.filter((c) => c.method === 'POST').length, 1);
    const states = [a.estado, b.estado].sort();
    assert.ok(states.includes('hecha'));
    const done = a.estado === 'hecha' ? a : b;
    assert.equal(done.accion.resultado?.enlace?.url, '/admin/rifas/r9/editar');
    const body = api.calls[0].body as Record<string, unknown>;
    assert.equal(body.drawDate, '2026-12-01T02:00:00.000Z');
    assert.equal(body.ticketPrice, 50);
    // Queda en el historial (para la IA) un mensaje "✅ …" con el enlace.
    const note = store.messages.at(-1)!.message;
    assert.equal(note.role, 'assistant');
    assert.match(note.role === 'assistant' ? note.content : '', /✅.*\(\/admin\/rifas\/r9\/editar\)/);

    // Un tercer toque no vuelve a ejecutar.
    const again = await service.confirmar(req(ADMIN, api), r.acciones[0].id, {});
    assert.equal(again.estado, 'hecha');
    assert.equal(api.calls.length, 1);
  });

  test('acción ajena y acción expirada', async () => {
    const ai = fakeAi([calls({ name: 'crear_rifa', args: RIFA_ARGS }), text('Revisa la tarjeta.')]);
    const { service, advance } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'rifa' });
    const actionId = r.acciones[0].id;
    const api = fakeApi({ 'POST /raffles': () => ({ status: 201, body: { raffle: { id: 'r1', title: 'x' } } }) });

    const other = { userId: 'admin2', role: 'RIFERO' as const, riferoId: 'rif2' };
    await assert.rejects(service.confirmar({ auth: other, api, siteUrl: SITE }, actionId, {}), (e: unknown) => e instanceof AssistantHttpError && e.statusCode === 404);
    await assert.rejects(service.cancelar(other, actionId), (e: unknown) => e instanceof AssistantHttpError && e.statusCode === 404);

    advance(31 * 60_000);
    const exp = await service.confirmar(req(ADMIN, api), actionId, {});
    assert.equal(exp.estado, 'expirada');
    assert.equal(api.calls.length, 0);
    const conv = await service.conversacion(ADMIN);
    const card = conv.items.find((i) => i.tipo === 'accion');
    assert.equal(card && card.tipo === 'accion' && card.estado, 'expirada');
  });

  test('cancelar: no cambia nada y lo dice', async () => {
    const ai = fakeAi([calls({ name: 'crear_rifa', args: RIFA_ARGS }), text('Revisa la tarjeta.')]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'rifa' });
    const c = await service.cancelar(ADMIN, r.acciones[0].id);
    assert.equal(c.estado, 'cancelada');
    assert.equal(c.texto, CANCEL_TEXT);
    const conv = await service.conversacion(ADMIN);
    const texts = conv.items.filter((i) => i.tipo === 'mensaje').map((i) => (i.tipo === 'mensaje' ? i.texto : ''));
    assert.deepEqual(texts, ['rifa', 'Revisa la tarjeta.', CANCEL_TEXT]);
    // La tarjeta va al final de su turno, después del texto del asistente.
    assert.deepEqual(conv.items.map((i) => i.tipo), ['mensaje', 'mensaje', 'accion', 'mensaje']);
  });

  test('un vendedor no puede crear rifas aunque la IA lo intente', async () => {
    let seen: Record<string, unknown> = {};
    const ai = fakeAi([
      calls({ name: 'crear_rifa', args: RIFA_ARGS }),
      (input) => {
        seen = lastToolResult(input);
        return text('Eso lo hace el administrador de la cuenta.');
      },
    ]);
    const { service, store } = setup({ ai });
    const r = await service.mensaje(req(SELLER), { texto: 'crea una rifa' });
    assert.equal(r.acciones.length, 0);
    assert.equal(store.actions.length, 0);
    assert.equal(seen.ok, false);
    assert.match(String(seen.error), /vendedores no pueden hacer cambios/);
    // Ni siquiera se le ofrecen herramientas de escritura.
    const names = ai.inputs[0].tools.map((t) => t.name);
    assert.ok(!names.includes('crear_rifa'));
    assert.ok(!names.includes('ver_datos_pago'));
    assert.ok(names.includes('ver_ordenes'));
  });

  test('si el usuario dejó de ser administrador, la confirmación falla', async () => {
    const ai = fakeAi([calls({ name: 'crear_rifa', args: RIFA_ARGS }), text('Revisa la tarjeta.')]);
    const { service, store } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'rifa' });
    store.users.set('admin1', { ...store.users.get('admin1')!, role: 'SELLER' });
    const api = fakeApi({});
    const c = await service.confirmar(req(ADMIN, api), r.acciones[0].id, {});
    assert.equal(c.estado, 'fallida');
    assert.equal(api.calls.length, 0);
  });

  test('errores del backend: el pensado para el rifero se muestra, el técnico no', async () => {
    const ai = fakeAi([calls({ name: 'publicar_rifa', args: { rifa_id: 'r1' } }), text('Revisa la tarjeta.')]);
    const { service } = setup({ ai });
    const raffle = { id: 'r1', title: 'Moto', eventLabel: 'E1', eventNumber: 1, status: 'DRAFT', hidden: false, images: [], ticketPrice: 50, totalTickets: 100, drawDate: null };
    const prepApi = fakeApi({
      'GET /raffles/r1': () => ({ status: 200, body: { raffle } }),
      'GET /riferos/me': () => ({ status: 200, body: { profile: { paymentMethods: [] } } }),
    });
    const r = await service.mensaje(req(ADMIN, prepApi), { texto: 'publica' });
    assert.ok(r.acciones[0].tarjeta.avisos.some((a) => /datos de pago/.test(a)));

    const api402 = fakeApi({ 'POST /raffles/r1/publish': () => ({ status: 402, body: { error: 'plan_limit', message: 'Activa un plan para publicar tus rifas' } }) });
    const c = await service.confirmar(req(ADMIN, api402), r.acciones[0].id, {});
    assert.equal(c.estado, 'fallida');
    assert.equal(c.texto, 'Activa un plan para publicar tus rifas');

    const ai2 = fakeAi([calls({ name: 'publicar_rifa', args: { rifa_id: 'r1' } }), text('ok')]);
    const s2 = setup({ ai: ai2 });
    const r2 = await s2.service.mensaje(req(ADMIN, prepApi), { texto: 'publica' });
    const api500 = fakeApi({ 'POST /raffles/r1/publish': () => ({ status: 500, body: { error: 'internal_error', message: 'Error interno del servidor' } }) });
    const c2 = await s2.service.confirmar(req(ADMIN, api500), r2.acciones[0].id, {});
    assert.equal(c2.texto, TECHNICAL_ERROR);
  });

  test('liberar: si la orden cambió (ya pagada) no libera nada', async () => {
    const order = (status: string) => ({
      id: 'o1', code: 'BSK-000001', raffleTitle: 'Moto', eventLabel: 'E1', status, hasProof: false, totalAmount: 100,
      ticketNumbers: ['001', '002'], giftNumbers: [], buyer: { fullName: 'Juan Pérez', phone: '6621112233', country: 'MX', whatsapp: null },
    });
    let current = 'RESERVED';
    const api = fakeApi({
      'GET /orders/o1': () => ({ status: 200, body: { order: order(current) } }),
      'PATCH /orders/o1/cancel': () => ({ status: 200, body: { order: order('CANCELLED') } }),
    });
    const ai = fakeAi([calls({ name: 'liberar_orden', args: { orden_id: 'o1' } }), text('Revisa la tarjeta.')]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN, api), { texto: 'libera a juan' });
    assert.equal(r.acciones[0].tarjeta.riesgo, true);
    current = 'PAID';
    const c = await service.confirmar(req(ADMIN, api), r.acciones[0].id, {});
    assert.equal(c.estado, 'fallida');
    assert.match(c.texto, /cambió/);
    assert.ok(!api.calls.some((x) => x.method === 'PATCH'));
  });

  test('marcar pagada lleva el WhatsApp del boleto como en Órdenes', async () => {
    const order = {
      id: 'o2', code: 'BSK-000002', raffleTitle: 'Moto', eventLabel: 'E1', status: 'PENDING', hasProof: true, totalAmount: 150,
      ticketNumbers: ['010'], giftNumbers: [], digitalTicketCode: null,
      buyer: { fullName: 'Luisa Gómez', phone: '6625556677', country: 'MX', whatsapp: null },
    };
    const api = fakeApi({
      'GET /orders/o2': () => ({ status: 200, body: { order } }),
      'PATCH /orders/o2/mark-paid': () => ({ status: 200, body: { order: { ...order, status: 'PAID' } } }),
    });
    const ai = fakeAi([calls({ name: 'marcar_orden_pagada', args: { orden_id: 'o2', forma_pago: 'transferencia' } }), text('Revisa la tarjeta.')]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN, api), { texto: 'ya pagó luisa' });
    const wa = r.acciones[0].tarjeta.whatsapp!;
    assert.match(wa.url, /^https:\/\/wa\.me\/526625556677\?text=/);
    assert.match(decodeURIComponent(wa.url), /rifasana\.com\/boleto\/BSK-000002/);
    const c = await service.confirmar(req(ADMIN, api), r.acciones[0].id, {});
    assert.equal(c.estado, 'hecha');
    assert.deepEqual(api.calls.find((x) => x.method === 'PATCH')!.body, { paymentMethod: 'transferencia', paymentNote: '' });
    assert.equal(c.accion.resultado?.whatsapp?.url, wa.url);
  });
});

describe('servicio: datos de pago', () => {
  test('tarjeta con un dígito mal: no hay tarjeta de confirmación', async () => {
    let seen: Record<string, unknown> = {};
    const ai = fakeAi([
      calls({ name: 'agregar_metodo_pago', args: { banco: 'BBVA', titular: 'Ana López', numero_tarjeta: '4152 3138 0000 0001' } }),
      (input) => {
        seen = lastToolResult(input);
        return text('El número no es válido, revísalo.');
      },
    ]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'agrega mi tarjeta' });
    assert.equal(r.acciones.length, 0);
    assert.match(String(seen.error), /4152 3138 0000 0001 no es válido: algún dígito está mal/);
  });

  test('agregar CLABE válida con aviso de banco y guardar como la pantalla', async () => {
    const profile = { paymentMethods: [{ id: 'legacy', bank: 'Banorte', holderName: 'Ana', clabe: null, cardNumber: '4111111111111111', concept: null, instructions: null }] };
    const api = fakeApi({
      'GET /riferos/me': () => ({ status: 200, body: { profile } }),
      'PATCH /riferos/me': (body) => ({ status: 200, body: { profile: body } }),
    });
    const ai = fakeAi([
      calls({ name: 'agregar_metodo_pago', args: { banco: 'Banorte', titular: 'Ana López', clabe: '012180000118359713' } }),
      text('Revisa cada dígito y toca **Confirmar**.'),
    ]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN, api), { texto: 'agrega mi clabe' });
    const card = r.acciones[0].tarjeta;
    assert.ok(card.campos.some((c) => c.etiqueta === 'CLABE' && c.valor === '0121 8000 0118 3597 13' && c.destacado));
    assert.ok(card.avisos.includes('Revisa cada dígito antes de confirmar.'));
    assert.ok(card.avisos.some((a) => /BBVA\/Bancomer/.test(a) && /Banorte/.test(a)));

    await service.confirmar(req(ADMIN, api), r.acciones[0].id, {});
    const patch = api.calls.find((x) => x.method === 'PATCH')!.body as { paymentMethods: { id: string; clabe: string }[]; payBank: string };
    assert.equal(patch.paymentMethods.length, 2);
    assert.notEqual(patch.paymentMethods[0].id, 'legacy');
    assert.equal(patch.paymentMethods[1].clabe, '012180000118359713');
    assert.equal(patch.payBank, 'Banorte'); // espejo del primer método
  });

  test('nunca guarda vencimiento ni CVV', async () => {
    let seen: Record<string, unknown> = {};
    const ai = fakeAi([
      calls({ name: 'agregar_metodo_pago', args: { banco: 'BBVA', titular: 'Ana', numero_tarjeta: '4111111111111111', nota: 'vence 12/28 cvv 123' } }),
      (input) => {
        seen = lastToolResult(input);
        return text('ok');
      },
    ]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'x' });
    assert.equal(r.acciones.length, 0);
    assert.match(String(seen.error), /No guardo vencimiento, CVV ni NIP/);
  });

  test('argumentos inválidos regresan un error a la IA', async () => {
    let seen: Record<string, unknown> = {};
    const ai = fakeAi([
      calls({ name: 'ver_rifa', invalidArgs: '{"rifa_id": ' }),
      (input) => {
        seen = lastToolResult(input);
        return text('Perdón, lo intento de nuevo.');
      },
    ]);
    const { service } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'mi rifa' });
    assert.equal(r.estado, 'ok');
    assert.match(String(seen.error), /JSON válido/);
  });
});

describe('servicio: llamadas y avisos', () => {
  test('la llamada avisa al equipo con cliente y página', async () => {
    const { service, notifier } = setup({ ai: null }); // funciona SIN IA
    const r = await service.llamada(req(ADMIN), { motivo: 'Mi página no abre y el sorteo es hoy' });
    assert.equal(r.llamada.telefono, '662 123 4567');
    assert.equal(notifier.sent.length, 1);
    const t = notifier.sent[0].texto;
    assert.match(t, /📞 LLAMADA URGENTE · Riffast/);
    assert.match(t, /Cliente: Rifas Ana — Ana/);
    assert.match(t, /Página: https:\/\/rifasana\.com/);
    assert.match(t, /Tel: 662 123 4567/);
    assert.match(t, /Motivo: Mi página no abre/);
    // Un segundo toque no duplica el aviso.
    const again = await service.llamada(req(ADMIN), {});
    assert.equal(again.duplicada, true);
    assert.equal(notifier.sent.length, 1);
  });

  test('agendar_llamada desde la IA devuelve la tarjeta de llamada', async () => {
    const ai = fakeAi([
      calls({ name: 'agendar_llamada', args: { telefono: '662 123 4567', motivo: 'No abre la página', urgencia: 'alta', ya_se_intento: 'Datos móviles e incógnito' } }),
      text('Listo, ya avisé al equipo.'),
    ]);
    const { service, notifier } = setup({ ai });
    const r = await service.mensaje(req(ADMIN), { texto: 'sí, márquenme' });
    assert.equal(r.llamada?.telefono, '662 123 4567');
    assert.match(notifier.sent[0].texto, /Ya se intentó: Datos móviles e incógnito/);
  });

  test('teléfono inválido en «Pedir llamada»', async () => {
    const { service } = setup();
    await assert.rejects(service.llamada(req(ADMIN), { telefono: '123' }), (e: unknown) => e instanceof AssistantHttpError && e.statusCode === 400);
  });

  test('IA caída: mensaje amable, permite llamada y alerta una sola vez por hora', async () => {
    const ai = fakeAi([new AiError('clave', 'La clave de IA no es válida (HTTP 401).', 401)]);
    const { service, notifier, store, advance } = setup({ ai });
    const r1 = await service.mensaje(req(ADMIN), { texto: 'hola' });
    assert.equal(r1.estado, 'error');
    assert.equal(r1.texto, AI_DOWN_TEXT);
    assert.equal(r1.permitirLlamada, true);
    await service.mensaje(req(ADMIN), { texto: 'hola otra vez' });
    // El mensaje del usuario se guarda aunque la IA falle.
    assert.equal(store.messages.filter((m) => m.message.role === 'user').length, 2);
    const alerts = () => notifier.sent.filter((a) => a.tipo === 'ia_caida');
    assert.equal(alerts().length, 1);
    assert.match(alerts()[0].texto, /⚠️ IA CAÍDA · Riffast/);
    assert.match(alerts()[0].texto, /Revisa AI_API_KEY, saldo o límites del proveedor/);
    advance(61 * 60_000);
    await service.mensaje(req(ADMIN), { texto: 'y ahora?' });
    assert.equal(alerts().length, 2);
  });

  test('configuración inválida también alerta; un 5xx no', async () => {
    const bad = setup({ aiError: new AiError('config', 'No reconozco el tipo de AI_API_KEY') });
    const r = await bad.service.mensaje(req(ADMIN), { texto: 'hola' });
    assert.equal(r.estado, 'error');
    assert.equal(bad.notifier.sent.length, 1);

    const flaky = setup({ ai: fakeAi([new AiError('proveedor', 'HTTP 503', 503)]) });
    await flaky.service.mensaje(req(ADMIN), { texto: 'hola' });
    assert.equal(flaky.notifier.sent.length, 0);
  });

  test('reintentar no duplica el mensaje del usuario', async () => {
    const ai = fakeAi([new AiError('red', 'timeout'), text('Ya respondí.')]);
    const { service, store } = setup({ ai });
    await service.mensaje(req(ADMIN), { texto: 'hola' });
    const r = await service.mensaje(req(ADMIN), { texto: 'hola', reintentar: true });
    assert.equal(r.texto, 'Ya respondí.');
    assert.equal(store.messages.filter((m) => m.message.role === 'user').length, 1);
  });

  test('nueva conversación', async () => {
    const { service } = setup();
    await service.mensaje(req(ADMIN), { texto: 'hola' });
    assert.ok((await service.conversacion(ADMIN)).items.length > 0);
    await service.nueva(ADMIN);
    assert.equal((await service.conversacion(ADMIN)).items.length, 0);
  });
});

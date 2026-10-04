import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AgentError, EMPTY_REPLY, MAX_STEPS, runAgent, STEPS_EXHAUSTED } from '../agent.js';
import { createAiClient } from '../ai/client.js';
import { resolveAiConfig } from '../ai/config.js';
import { AiError } from '../ai/http.js';
import { NO_VISION_NOTE } from '../ai/history.js';
import type { ToolCall } from '../ai/types.js';
import { calls, fakeAi, text } from './helpers.js';

const base = { system: 'S', history: [{ role: 'user' as const, content: 'hola' }], tools: [] };

describe('agente', () => {
  test('herramienta → respuesta', async () => {
    const ai = fakeAi([calls({ name: 'ver_resumen' }), text('Llevas 40 vendidos.')]);
    const executed: ToolCall[] = [];
    const r = await runAgent({
      ...base,
      client: ai,
      execTool: async (c) => {
        executed.push(c);
        return { ok: true, vendidos: 40 };
      },
    });
    assert.equal(r.texto, 'Llevas 40 vendidos.');
    assert.equal(executed.length, 1);
    assert.deepEqual(r.nuevos.map((m) => m.message.role), ['assistant', 'tool', 'assistant']);
    const tool = r.nuevos[1].message;
    assert.equal(tool.role === 'tool' && JSON.parse(tool.content).vendidos, 40);
    // La segunda vuelta recibe la llamada y su resultado.
    assert.equal(ai.inputs[1].messages.length, 3);
  });

  test('texto antes de usar herramientas también se muestra', async () => {
    const withText = calls({ name: 'ver_rifas' });
    withText.texto = 'Déjame revisar.';
    withText.mensaje.content = 'Déjame revisar.';
    const r = await runAgent({ ...base, client: fakeAi([withText, text('Tienes 2 rifas.')]), execTool: async () => ({ ok: true }) });
    assert.equal(r.texto, 'Déjame revisar.\n\nTienes 2 rifas.');
  });

  test('respuesta vacía: reintenta una vez y luego pide reformular', async () => {
    const once = await runAgent({ ...base, client: fakeAi([text(''), text('Ya entendí.')]), execTool: async () => ({}) });
    assert.equal(once.texto, 'Ya entendí.');

    const twice = await runAgent({ ...base, client: fakeAi([text(''), text('')]), execTool: async () => ({}) });
    assert.equal(twice.texto, EMPTY_REPLY);
    assert.equal(twice.vacio, true);
    assert.equal(twice.nuevos.at(-1)?.message.role, 'assistant');

    const card = await runAgent({
      ...base,
      client: fakeAi([text(''), text('')]),
      execTool: async () => ({}),
      emptyFallback: () => 'Revisa la tarjeta.',
    });
    assert.equal(card.texto, 'Revisa la tarjeta.');
  });

  test('límite de pasos', async () => {
    const ai = fakeAi([calls({ name: 'ver_resumen' })]);
    let n = 0;
    const r = await runAgent({ ...base, client: ai, execTool: async () => ({ ok: true, n: ++n }) });
    assert.equal(ai.inputs.length, MAX_STEPS);
    assert.equal(r.pasosAgotados, true);
    assert.match(r.texto, new RegExp(STEPS_EXHAUSTED.slice(0, 20)));
    assert.match(r.texto, /Pedir llamada/);
  });

  test('herramienta que truena no rompe el bucle', async () => {
    const r = await runAgent({
      ...base,
      client: fakeAi([calls({ name: 'ver_rifas' }), text('No pude ver tus rifas, intenta de nuevo.')]),
      execTool: async () => {
        throw new Error('BD caída');
      },
    });
    const tool = r.nuevos[1].message;
    assert.equal(tool.role, 'tool');
    const content = tool.role === 'tool' ? JSON.parse(tool.content) : null;
    assert.equal(content.ok, false);
    assert.match(content.error, /falló/);
    assert.equal(r.texto, 'No pude ver tus rifas, intenta de nuevo.');
  });

  test('error de la IA a media vuelta conserva lo hecho', async () => {
    const ai = fakeAi([calls({ name: 'crear_rifa' }), new AiError('limite', 'HTTP 429')]);
    await assert.rejects(
      runAgent({ ...base, client: ai, execTool: async () => ({ ok: true, estado: 'esperando_confirmacion' }) }),
      (e: unknown) => {
        assert.ok(e instanceof AgentError);
        assert.equal(e.cause.tipo, 'limite');
        assert.equal(e.parcial.length, 2); // llamada + resultado
        return true;
      },
    );
  });

  test('imagen con un modelo que no las lee: llega como texto', async () => {
    const cfg = resolveAiConfig({ AI_API_KEY: 'gsk_x' })!;
    let sent: { messages: { content: unknown }[] } | null = null;
    const client = createAiClient(cfg, {
      fetch: (async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: '¿Me escribes los números?' } }] }), { status: 200 });
      }) as unknown as typeof fetch,
      sleep: async () => {},
    });
    const r = await runAgent({
      client,
      system: 'S',
      history: [{ role: 'user', content: 'agrega esta', images: [{ mimeType: 'image/jpeg', data: 'AAAA' }] }],
      tools: [],
      execTool: async () => ({}),
    });
    assert.equal(r.texto, '¿Me escribes los números?');
    const user = sent!.messages[1].content;
    assert.equal(typeof user, 'string');
    assert.ok(String(user).includes(NO_VISION_NOTE));
  });
});

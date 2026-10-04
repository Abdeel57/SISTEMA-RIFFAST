import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectProvider, resolveAiConfig } from '../ai/config.js';
import { createAiClient, loadAiStatus } from '../ai/client.js';
import { AiError, type HttpDeps } from '../ai/http.js';
import { anthropicTranslator } from '../ai/anthropic.js';
import { geminiTranslator, cleanSchema } from '../ai/gemini.js';
import { openAiTranslator } from '../ai/openai.js';
import { trimHistory, NO_VISION_NOTE } from '../ai/history.js';
import type { AiConfig, ChatInput, NeutralMessage, ToolDef } from '../ai/types.js';

// ── Utilidades ──────────────────────────────────────────────────────
function cfg(env: Record<string, string>): AiConfig {
  const c = resolveAiConfig(env);
  assert.ok(c);
  return c;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

interface Recorded {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function mockDeps(responses: (Response | (() => Response))[]): HttpDeps & { calls: Recorded[]; sleeps: number[] } {
  const calls: Recorded[] = [];
  const sleeps: number[] = [];
  let i = 0;
  return {
    calls,
    sleeps,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      const r = responses[Math.min(i++, responses.length - 1)];
      return typeof r === 'function' ? r() : r;
    }) as unknown as typeof fetch,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
}

const TOOLS: ToolDef[] = [
  { name: 'ver_resumen', description: 'Resumen.', parameters: { type: 'object', properties: {} } },
  {
    name: 'ver_rifa',
    description: 'Una rifa.',
    parameters: {
      type: 'object',
      properties: { rifa_id: { type: 'string', default: 'x', examples: ['r1'] } },
      required: ['rifa_id'],
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    },
  },
];

// Historial con un par llamada/resultado y un mensaje nuevo.
const HISTORY: NeutralMessage[] = [
  { role: 'user', content: '¿Cómo voy?' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'ver_resumen', args: {} }] },
  { role: 'tool', toolCallId: 'c1', name: 'ver_resumen', content: '{"ok":true,"vendidos":40}' },
  { role: 'assistant', content: 'Llevas 40 vendidos.' },
  { role: 'user', content: 'Gracias' },
];

const SYSTEM = { fijo: 'Eres el asistente.', variable: 'Contexto: hoy.' };

// ── Detección por prefijo ───────────────────────────────────────────
describe('detección de proveedor', () => {
  test('por prefijo de la clave', () => {
    assert.equal(detectProvider('sk-ant-api03-abc'), 'anthropic');
    assert.equal(detectProvider('sk-or-v1-abc'), 'openrouter');
    assert.equal(detectProvider('AIzaSyAbc'), 'gemini');
    assert.equal(detectProvider('AQ.Ab8RN6Kabc'), 'gemini'); // formato nuevo de AI Studio
    assert.equal(detectProvider('gsk_abc'), 'groq');
    assert.equal(detectProvider('xai-abc'), 'xai');
    assert.equal(detectProvider('csk-abc'), 'cerebras');
    assert.equal(detectProvider('sk-0123456789abcdef0123456789abcdef'), 'deepseek');
    assert.equal(detectProvider('sk-proj-abc123'), 'openai');
    assert.equal(detectProvider('abc123'), null);
  });

  test('modelos por defecto y visión', () => {
    assert.equal(cfg({ AI_API_KEY: 'sk-ant-x' }).model, 'claude-haiku-4-5-20251001');
    assert.equal(cfg({ AI_API_KEY: 'AIzaX' }).model, 'gemini-3.1-flash-lite');
    assert.equal(cfg({ AI_API_KEY: 'gsk_x' }).vision, false);
    assert.equal(cfg({ AI_API_KEY: 'gsk_x', AI_VISION: 'true' }).vision, true);
    assert.equal(cfg({ AI_API_KEY: 'sk-x', AI_MODEL: 'gpt-x' }).model, 'gpt-x');
    assert.equal(cfg({ AI_API_KEY: 'sk-x' }).maxTokens, 2048);
    assert.equal(cfg({ AI_API_KEY: 'sk-x' }).timeoutMs, 60000);
  });

  test('sin prefijo exige AI_PROVIDER', () => {
    assert.throws(() => resolveAiConfig({ AI_API_KEY: 'mi-clave' }), (e: unknown) => e instanceof AiError && e.tipo === 'config' && /AI_PROVIDER/.test(e.message) && /mistral/.test(e.message));
    const m = cfg({ AI_API_KEY: 'mi-clave', AI_PROVIDER: 'mistral' });
    assert.equal(m.model, 'mistral-small-latest');
    assert.equal(m.baseUrl, 'https://api.mistral.ai/v1');
  });

  test('compatible exige AI_BASE_URL; proveedor inválido da error claro', () => {
    assert.throws(() => resolveAiConfig({ AI_API_KEY: 'x', AI_PROVIDER: 'compatible', AI_MODEL: 'llama' }), /AI_BASE_URL/);
    assert.throws(() => resolveAiConfig({ AI_API_KEY: 'x', AI_PROVIDER: 'foo' }), /anthropic, openai/);
    const c = cfg({ AI_API_KEY: 'x', AI_PROVIDER: 'compatible', AI_BASE_URL: 'http://localhost:11434/v1/', AI_MODEL: 'llama3' });
    assert.equal(c.baseUrl, 'http://localhost:11434/v1');
    assert.equal(c.format, 'openai');
  });

  test('sin clave: el cliente es null', () => {
    const s = loadAiStatus({});
    assert.equal(s.configured, false);
    assert.equal(s.client, null);
    const bad = loadAiStatus({ AI_API_KEY: 'rara' });
    assert.equal(bad.configured, true);
    assert.equal(bad.error?.tipo, 'config');
  });
});

// ── Peticiones ──────────────────────────────────────────────────────
describe('Anthropic', () => {
  const c = cfg({ AI_API_KEY: 'sk-ant-test' });

  test('headers, system en bloques con cache y tool_result dentro de user', () => {
    const req = anthropicTranslator.build({ system: SYSTEM, messages: HISTORY, tools: TOOLS }, c);
    assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(req.headers['x-api-key'], 'sk-ant-test');
    assert.equal(req.headers['anthropic-version'], '2023-06-01');
    const body = req.body as { system: Record<string, unknown>[]; messages: { role: string; content: Record<string, unknown>[] }[]; tools: Record<string, unknown>[]; max_tokens: number };
    assert.deepEqual(body.system[0], { type: 'text', text: 'Eres el asistente.', cache_control: { type: 'ephemeral' } });
    assert.equal(body.system[1].cache_control, undefined);
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.messages[0].role, 'user');
    // tool_use en assistant, tool_result en user
    assert.equal(body.messages[1].content[0].type, 'tool_use');
    assert.equal(body.messages[2].role, 'user');
    assert.equal(body.messages[2].content[0].type, 'tool_result');
    assert.equal(body.messages[2].content[0].tool_use_id, 'c1');
    assert.equal(body.tools[1].input_schema !== undefined, true);
    // Roles siempre alternados
    for (let i = 1; i < body.messages.length; i++) assert.notEqual(body.messages[i].role, body.messages[i - 1].role);
  });

  test('fusiona roles consecutivos y empieza en user; reusa content crudo sin textos vacíos', () => {
    const msgs: NeutralMessage[] = [
      { role: 'assistant', content: 'hola' },
      { role: 'user', content: 'a' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't1', name: 'ver_resumen', args: {} }],
        raw: { proveedor: 'anthropic', content: [{ type: 'text', text: '' }, { type: 'tool_use', id: 't1', name: 'ver_resumen', input: {} }] },
      },
      { role: 'tool', toolCallId: 't1', name: 'ver_resumen', content: '{}' },
      { role: 'user', content: 'b' },
    ];
    const body = anthropicTranslator.build({ system: 'S', messages: msgs, tools: [] }, c).body as { messages: { role: string; content: Record<string, unknown>[] }[] };
    assert.equal(body.messages[0].role, 'user');
    assert.deepEqual(body.messages[1].content, [{ type: 'tool_use', id: 't1', name: 'ver_resumen', input: {} }]);
    assert.equal(body.messages[2].content.length, 2); // tool_result + texto "b" fusionados
    assert.equal(body.messages[2].content[0].type, 'tool_result');
  });

  test('lee la respuesta', () => {
    const r = anthropicTranslator.parse(
      {
        content: [
          { type: 'text', text: 'Reviso.' },
          { type: 'tool_use', id: 'tu1', name: 'ver_rifa', input: { rifa_id: 'r1' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 },
      },
      c,
    );
    assert.equal(r.texto, 'Reviso.');
    assert.deepEqual(r.llamadas, [{ id: 'tu1', name: 'ver_rifa', args: { rifa_id: 'r1' } }]);
    assert.equal(r.uso.entrada, 110);
    assert.equal(r.mensaje.raw?.proveedor, 'anthropic');
  });
});

describe('Gemini', () => {
  const c = cfg({ AI_API_KEY: 'AIzaTest' });

  test('petición: header, roles, functionResponse como objeto y esquema limpio', () => {
    const req = geminiTranslator.build({ system: SYSTEM, messages: HISTORY, tools: TOOLS }, c);
    assert.equal(req.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(req.headers['x-goog-api-key'], 'AIzaTest');
    const body = req.body as {
      contents: { role: string; parts: Record<string, unknown>[] }[];
      tools: { functionDeclarations: Record<string, unknown>[] }[];
      systemInstruction: { parts: { text: string }[] };
    };
    assert.deepEqual(body.systemInstruction.parts.map((p) => p.text), ['Eres el asistente.', 'Contexto: hoy.']);
    assert.deepEqual(body.contents.map((x) => x.role), ['user', 'model', 'user', 'model', 'user']);
    const fr = body.contents[2].parts[0].functionResponse as Record<string, unknown>;
    assert.deepEqual(fr.response, { ok: true, vendidos: 40 });
    assert.equal(fr.id, undefined); // c1 no lo generó Gemini
    const decls = body.tools[0].functionDeclarations;
    assert.equal('parameters' in decls[0], false); // sin parámetros → sin `parameters`
    const params = decls[1].parameters as Record<string, unknown>;
    assert.equal('additionalProperties' in params, false);
    assert.equal('$schema' in params, false);
    const prop = (params.properties as Record<string, Record<string, unknown>>).rifa_id;
    assert.deepEqual(prop, { type: 'string' });
  });

  test('cleanSchema conserva propiedades llamadas como palabras reservadas', () => {
    const s = cleanSchema({ type: 'object', properties: { default: { type: 'string', const: 'x' } } }) as { properties: Record<string, unknown> };
    assert.deepEqual(s.properties.default, { type: 'string' });
  });

  test('reenvía thoughtSignature y solo pone id si Gemini lo mandó', () => {
    const raw = {
      role: 'model',
      parts: [{ functionCall: { id: 'g-1', name: 'ver_resumen', args: {} }, thoughtSignature: 'FIRMA123' }],
    };
    const r = geminiTranslator.parse({ candidates: [{ content: raw, finishReason: 'STOP' }] }, c);
    assert.equal(r.llamadas[0].id, 'g-1');
    const msgs: NeutralMessage[] = [
      { role: 'user', content: 'hola' },
      r.mensaje,
      { role: 'tool', toolCallId: 'g-1', name: 'ver_resumen', content: '[1,2]' },
    ];
    const body = geminiTranslator.build({ system: 'S', messages: msgs, tools: [] }, c).body as { contents: { role: string; parts: Record<string, unknown>[] }[] };
    assert.equal(body.contents[1].parts[0].thoughtSignature, 'FIRMA123');
    const fr = body.contents[2].parts[0].functionResponse as Record<string, unknown>;
    assert.equal(fr.id, 'g-1');
    assert.deepEqual(fr.response, { resultado: [1, 2] });

    // Sin id de Gemini: el id es local y no viaja en functionResponse.
    const r2 = geminiTranslator.parse({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'ver_resumen', args: {} }, thoughtSignature: 'F2' }] } }] }, c);
    const body2 = geminiTranslator.build(
      { system: 'S', messages: [{ role: 'user', content: 'x' }, r2.mensaje, { role: 'tool', toolCallId: r2.llamadas[0].id, name: 'ver_resumen', content: '{}' }], tools: [] },
      c,
    ).body as { contents: { parts: Record<string, unknown>[] }[] };
    assert.equal((body2.contents[2].parts[0].functionResponse as Record<string, unknown>).id, undefined);
  });

  test('respuesta bloqueada o vacía no truena', () => {
    const r = geminiTranslator.parse({ promptFeedback: { blockReason: 'SAFETY' } }, c);
    assert.equal(r.texto, '');
    assert.equal(r.fin, 'bloqueado');
    assert.deepEqual(r.llamadas, []);
    const empty = geminiTranslator.parse({}, c);
    assert.equal(empty.fin, 'vacio');
  });
});

describe('OpenAI y compatibles', () => {
  test('OpenAI oficial: max_completion_tokens y reasoning_effort low', () => {
    const c = cfg({ AI_API_KEY: 'sk-proj-x' });
    const req = openAiTranslator.build({ system: SYSTEM, messages: HISTORY, tools: TOOLS }, c);
    const body = req.body as Record<string, unknown> & { messages: Record<string, unknown>[] };
    assert.equal(req.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(req.headers.Authorization, 'Bearer sk-proj-x');
    assert.equal(body.max_completion_tokens, 2048);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[0].content, 'Eres el asistente.\n\nContexto: hoy.');
    const asst = body.messages[2] as { content: string; tool_calls: { function: { arguments: string } }[] };
    assert.equal(asst.content, '');
    assert.equal(typeof asst.tool_calls[0].function.arguments, 'string');
    assert.equal(body.messages[3].role, 'tool');
    assert.equal(body.messages[3].name, undefined);
  });

  test('compatibles usan max_tokens; groq gpt-oss lleva reasoning low; deepseek no', () => {
    const g = openAiTranslator.build({ system: 'S', messages: HISTORY, tools: [] }, cfg({ AI_API_KEY: 'gsk_x' })).body as Record<string, unknown>;
    assert.equal(g.max_tokens, 2048);
    assert.equal(g.max_completion_tokens, undefined);
    assert.equal(g.reasoning_effort, 'low');
    const d = openAiTranslator.build({ system: 'S', messages: HISTORY, tools: [] }, cfg({ AI_API_KEY: 'sk-0123456789abcdef0123456789abcdef' })).body as Record<string, unknown>;
    assert.equal(d.reasoning_effort, undefined);
  });

  test('Mistral: el mensaje tool lleva name; OpenRouter: X-Title y reasoning_details', () => {
    const m = openAiTranslator.build({ system: 'S', messages: HISTORY, tools: [] }, cfg({ AI_API_KEY: 'k', AI_PROVIDER: 'mistral' })).body as { messages: Record<string, unknown>[] };
    assert.equal(m.messages[3].name, 'ver_resumen');

    const orCfg = cfg({ AI_API_KEY: 'sk-or-x', ASISTENTE_MARCA: 'Riffast' });
    const parsed = openAiTranslator.parse(
      { choices: [{ message: { content: null, tool_calls: [{ id: 'a', function: { name: 'ver_resumen', arguments: '{}' } }], reasoning_details: [{ type: 'reasoning.text', text: 'x' }] }, finish_reason: 'tool_calls' }] },
      orCfg,
    );
    const req = openAiTranslator.build(
      { system: 'S', messages: [{ role: 'user', content: 'x' }, parsed.mensaje, { role: 'tool', toolCallId: 'a', name: 'ver_resumen', content: '{}' }], tools: [] },
      orCfg,
    );
    assert.equal(req.headers['X-Title'], 'Riffast');
    const asst = (req.body as { messages: Record<string, unknown>[] }).messages[2];
    assert.deepEqual(asst.reasoning_details, [{ type: 'reasoning.text', text: 'x' }]);
  });

  test('argumentos con JSON roto no truenan', () => {
    const r = openAiTranslator.parse(
      { choices: [{ message: { content: 'ok', tool_calls: [{ id: 'z', function: { name: 'ver_rifa', arguments: '{"rifa_id": "r1"' } }] } }] },
      cfg({ AI_API_KEY: 'sk-x' }),
    );
    assert.equal(r.llamadas.length, 1);
    assert.deepEqual(r.llamadas[0].args, {});
    assert.equal(r.llamadas[0].invalidArgs, '{"rifa_id": "r1"');
    assert.equal(r.texto, 'ok');
  });
});

// ── Red: reintentos y errores ───────────────────────────────────────
describe('red', () => {
  const okOpenAi = () => jsonResponse(200, { choices: [{ message: { content: 'hola' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } });
  const input: ChatInput = { system: 'S', messages: [{ role: 'user', content: 'hola' }], tools: [] };

  test('reintenta en 429 y 503', async () => {
    const deps = mockDeps([jsonResponse(429, { error: { message: 'rate' } }), jsonResponse(503, {}), okOpenAi]);
    const client = createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps);
    const r = await client.chat(input);
    assert.equal(r.texto, 'hola');
    assert.equal(deps.calls.length, 3);
    assert.equal(deps.sleeps.length, 2);
  });

  test('respeta retry-after corto y falla con limite si piden más de 8 s', async () => {
    const deps = mockDeps([jsonResponse(429, {}, { 'retry-after': '2' }), okOpenAi]);
    await createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps).chat(input);
    assert.deepEqual(deps.sleeps, [2000]);

    const deps2 = mockDeps([jsonResponse(429, {}, { 'retry-after': '30' })]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps2).chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'limite');
    assert.equal(deps2.calls.length, 1);
  });

  test('después de 2 reintentos falla con el tipo correcto', async () => {
    const deps = mockDeps([jsonResponse(500, {})]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps).chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'proveedor');
    assert.equal(deps.calls.length, 3);
    const deps429 = mockDeps([jsonResponse(429, {})]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps429).chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'limite');
  });

  test('tool_use_failed de Groq se reintenta', async () => {
    const deps = mockDeps([jsonResponse(400, { error: { code: 'tool_use_failed', message: 'bad call' } }), okOpenAi]);
    const r = await createAiClient(cfg({ AI_API_KEY: 'gsk_x' }), deps).chat(input);
    assert.equal(r.texto, 'hola');
    assert.equal(deps.calls.length, 2);
  });

  test('errores clave y modelo (sin reintentos y sin filtrar la clave)', async () => {
    const d401 = mockDeps([jsonResponse(401, { error: { message: 'Incorrect API key provided: sk-proj-abcdef123456' } })]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-proj-abcdef123456' }), d401).chat(input), (e: unknown) => {
      assert.ok(e instanceof AiError);
      assert.equal(e.tipo, 'clave');
      assert.ok(!e.message.includes('abcdef123456'));
      return true;
    });
    assert.equal(d401.calls.length, 1);

    const dGem = mockDeps([jsonResponse(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } })]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'AIzaX' }), dGem).chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'clave');

    const d404 = mockDeps([jsonResponse(404, { error: { message: 'model not found' } })]);
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-ant-x', AI_MODEL: 'claude-viejo' }), d404).chat(input), (e: unknown) => {
      assert.ok(e instanceof AiError);
      assert.equal(e.tipo, 'modelo');
      assert.match(e.message, /pon AI_MODEL/);
      assert.match(e.message, /claude-viejo/);
      return true;
    });
  });

  test('timeout → red', async () => {
    const deps: HttpDeps = {
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })) as unknown as typeof fetch,
      sleep: async () => {},
    };
    const client = createAiClient(cfg({ AI_API_KEY: 'sk-x', AI_TIMEOUT_MS: '20' }), deps);
    await assert.rejects(client.chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'red' && /timeout/.test(e.message));
  });

  test('sin conexión → red', async () => {
    const deps: HttpDeps = { fetch: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch, sleep: async () => {} };
    await assert.rejects(createAiClient(cfg({ AI_API_KEY: 'sk-x' }), deps).chat(input), (e: unknown) => e instanceof AiError && e.tipo === 'red');
  });
});

// ── Historial e imágenes ────────────────────────────────────────────
describe('historial', () => {
  test('recorta a 24 sin partir pares y empieza en user', () => {
    const msgs: NeutralMessage[] = [];
    for (let i = 0; i < 10; i++) {
      msgs.push({ role: 'user', content: `u${i}` });
      msgs.push({ role: 'assistant', content: '', toolCalls: [{ id: `c${i}`, name: 'ver_resumen', args: {} }] });
      msgs.push({ role: 'tool', toolCallId: `c${i}`, name: 'ver_resumen', content: '{}' });
      msgs.push({ role: 'assistant', content: `a${i}` });
    }
    const t = trimHistory(msgs, 24);
    assert.ok(t.length <= 24);
    assert.equal(t[0].role, 'user');
    const calls = new Set(t.flatMap((m) => (m.role === 'assistant' ? (m.toolCalls ?? []).map((c) => c.id) : [])));
    const results = new Set(t.flatMap((m) => (m.role === 'tool' ? [m.toolCallId] : [])));
    assert.deepEqual([...calls].sort(), [...results].sort());
  });

  test('quita llamadas sin resultado', () => {
    const t = trimHistory([
      { role: 'user', content: 'x' },
      { role: 'assistant', content: 'voy', toolCalls: [{ id: 'k', name: 'ver_resumen', args: {} }], raw: { proveedor: 'anthropic', content: [] } },
      { role: 'user', content: 'y' },
    ]);
    const a = t[1];
    assert.equal(a.role, 'assistant');
    assert.equal(a.role === 'assistant' && a.toolCalls, undefined);
    assert.equal(a.role === 'assistant' && a.raw, undefined);
  });

  test('imagen con un modelo que no las lee: se quita y se avisa', async () => {
    const deps = mockDeps([jsonResponse(200, { choices: [{ message: { content: 'Escríbeme los datos' } }] })]);
    const client = createAiClient(cfg({ AI_API_KEY: 'gsk_x' }), deps);
    await client.chat({ system: 'S', messages: [{ role: 'user', content: 'agrega esta', images: [{ mimeType: 'image/jpeg', data: 'AAAA' }] }], tools: [] });
    const sent = deps.calls[0].body as { messages: { role: string; content: unknown }[] };
    assert.equal(typeof sent.messages[1].content, 'string');
    assert.ok(String(sent.messages[1].content).includes(NO_VISION_NOTE));
  });

  test('con visión la imagen viaja', async () => {
    const deps = mockDeps([jsonResponse(200, { content: [{ type: 'text', text: 'Leí tu tarjeta' }] })]);
    await createAiClient(cfg({ AI_API_KEY: 'sk-ant-x' }), deps).chat({ system: 'S', messages: [{ role: 'user', content: 'agrega', images: [{ mimeType: 'image/png', data: 'BBBB' }] }], tools: [] });
    const sent = deps.calls[0].body as { messages: { content: Record<string, unknown>[] }[] };
    assert.equal(sent.messages[0].content[0].type, 'image');
  });
});

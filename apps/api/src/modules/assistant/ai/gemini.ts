// Traductor Gemini generateContent.
//   - Header x-goog-api-key; roles user/model.
//   - functionResponse va en user, con `response` como objeto.
//   - El esquema se limpia (sin additionalProperties, $schema, $ref, default,
//     examples ni const); funciones sin parámetros van SIN `parameters`.
//   - Gemini 3 exige recibir de vuelta sus thoughtSignature: se guarda
//     candidates[0].content crudo y se reenvía tal cual.
//   - `id` en functionResponse solo si Gemini lo puso en su functionCall.
//   - Respuesta bloqueada o vacía: no truena, regresa texto vacío.
import { parseToolContent, systemText } from './history.js';
import type { AiConfig, ChatInput, ChatResult, HttpRequest, JsonSchema, ToolCall, Translator } from './types.js';

type Part = Record<string, unknown>;
interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

const STRIP_KEYS = new Set(['additionalProperties', '$schema', '$ref', 'default', 'examples', 'const']);

// Firma "comodín" documentada por Google para llamadas que no generó Gemini
// (historial que viene de otro proveedor). Evita el 400 de Gemini 3.
const FOREIGN_SIGNATURE = 'skip_thought_signature_validator';

// Prefijo de los ids que inventamos cuando Gemini no manda `id`.
const LOCAL_ID = 'gemini-local-';

export function cleanSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(cleanSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (STRIP_KEYS.has(k)) continue;
    out[k] = k === 'properties' && v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, cleanSchema(pv)]))
      : cleanSchema(v);
  }
  return out;
}

function hasParams(schema: JsonSchema): boolean {
  return !!schema.properties && Object.keys(schema.properties).length > 0;
}

function toResponseObject(content: string): Record<string, unknown> {
  const parsed = parseToolContent(content);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  return { resultado: parsed };
}

function buildContents(input: ChatInput): Content[] {
  const out: Content[] = [];
  const push = (role: 'user' | 'model', parts: Part[]) => {
    if (!parts.length) return;
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else out.push({ role, parts: [...parts] });
  };
  // ids de llamadas que Gemini sí mandó (para decidir si functionResponse lleva id).
  const geminiIds = new Set<string>();

  for (const m of input.messages) {
    if (m.role === 'user') {
      const parts: Part[] = [];
      if (m.content.trim()) parts.push({ text: m.content });
      for (const img of m.images ?? []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      push('user', parts);
    } else if (m.role === 'assistant') {
      const rawContent = m.raw?.proveedor === 'gemini' ? (m.raw.content as Content | undefined) : undefined;
      if (rawContent && Array.isArray(rawContent.parts)) {
        for (const p of rawContent.parts) {
          const fc = p.functionCall as { id?: unknown } | undefined;
          if (fc && typeof fc.id === 'string' && fc.id) geminiIds.add(fc.id);
        }
        push('model', rawContent.parts);
        continue;
      }
      const parts: Part[] = [];
      if (m.content.trim()) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: c.name, args: c.args ?? {} }, thoughtSignature: FOREIGN_SIGNATURE });
      }
      push('model', parts);
    } else {
      const fr: Record<string, unknown> = { name: m.name, response: toResponseObject(m.content) };
      if (geminiIds.has(m.toolCallId) && !m.toolCallId.startsWith(LOCAL_ID)) fr.id = m.toolCallId;
      push('user', [{ functionResponse: fr }]);
    }
  }

  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export const geminiTranslator: Translator = {
  build(input: ChatInput, cfg: AiConfig): HttpRequest {
    const body: Record<string, unknown> = {
      contents: buildContents(input),
      generationConfig: { maxOutputTokens: cfg.maxTokens },
    };
    if (typeof input.system === 'string') {
      if (input.system.trim()) body.systemInstruction = { parts: [{ text: input.system }] };
    } else {
      const parts = [input.system.fijo, input.system.variable].filter((t) => t.trim()).map((text) => ({ text }));
      if (parts.length) body.systemInstruction = { parts };
    }
    if (input.tools.length) {
      body.tools = [
        {
          functionDeclarations: input.tools.map((t) => {
            const decl: Record<string, unknown> = { name: t.name, description: t.description };
            if (hasParams(t.parameters)) decl.parameters = cleanSchema(t.parameters);
            return decl;
          }),
        },
      ];
    }
    return {
      url: `${cfg.baseUrl}/models/${encodeURIComponent(cfg.model)}:generateContent`,
      headers: { 'x-goog-api-key': cfg.apiKey },
      body,
    };
  },

  parse(json: unknown): ChatResult {
    const j = (json ?? {}) as {
      candidates?: { content?: Content; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    };
    const cand = j.candidates?.[0];
    const content = cand?.content;
    const parts = Array.isArray(content?.parts) ? content!.parts : [];

    const texto = parts
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text as string)
      .join('');

    const llamadas: ToolCall[] = [];
    parts.forEach((p, i) => {
      const fc = p.functionCall as { id?: unknown; name?: unknown; args?: unknown } | undefined;
      if (!fc || typeof fc.name !== 'string') return;
      const args = fc.args && typeof fc.args === 'object' && !Array.isArray(fc.args) ? (fc.args as Record<string, unknown>) : {};
      const id = typeof fc.id === 'string' && fc.id ? fc.id : `${LOCAL_ID}${Date.now().toString(36)}-${i}`;
      llamadas.push({ id, name: fc.name, args });
    });

    const u = j.usageMetadata ?? {};
    const fin = !cand ? (j.promptFeedback?.blockReason ? 'bloqueado' : 'vacio') : (cand.finishReason ?? 'STOP');

    return {
      texto,
      llamadas,
      fin,
      uso: { entrada: u.promptTokenCount ?? 0, salida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
      mensaje: {
        role: 'assistant',
        content: texto,
        ...(llamadas.length ? { toolCalls: llamadas } : {}),
        // candidates[0].content crudo (con sus thoughtSignature), tal cual.
        ...(content && parts.length ? { raw: { proveedor: 'gemini', content } } : {}),
      },
    };
  },
};

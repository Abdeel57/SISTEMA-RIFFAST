// Traductor Anthropic Messages.
//   - Headers x-api-key + anthropic-version.
//   - system en bloques; el bloque fijo lleva cache_control para pagar menos.
//   - tool_result va dentro de un mensaje user; roles consecutivos se fusionan y
//     la conversación empieza en user.
//   - Al reenviar se usa el content crudo de la respuesta (sin bloques de texto vacíos).
import type { AiConfig, ChatInput, ChatResult, HttpRequest, ToolCall, Translator } from './types.js';

type Block = Record<string, unknown>;
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Block[];
}

const nonEmptyBlocks = (blocks: unknown): Block[] =>
  Array.isArray(blocks)
    ? (blocks as Block[]).filter((b) => b && typeof b === 'object' && !(b.type === 'text' && !String(b.text ?? '').trim()))
    : [];

function systemBlocks(input: ChatInput): Block[] {
  if (typeof input.system === 'string') {
    return input.system.trim() ? [{ type: 'text', text: input.system }] : [];
  }
  const blocks: Block[] = [];
  if (input.system.fijo.trim()) {
    blocks.push({ type: 'text', text: input.system.fijo, cache_control: { type: 'ephemeral' } });
  }
  if (input.system.variable.trim()) blocks.push({ type: 'text', text: input.system.variable });
  return blocks;
}

function buildMessages(input: ChatInput): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  const push = (role: 'user' | 'assistant', content: Block[]) => {
    if (!content.length) return;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...content);
    else out.push({ role, content: [...content] });
  };

  for (const m of input.messages) {
    if (m.role === 'user') {
      const blocks: Block[] = [];
      for (const img of m.images ?? []) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } });
      }
      if (m.content.trim()) blocks.push({ type: 'text', text: m.content });
      push('user', blocks);
    } else if (m.role === 'assistant') {
      if (m.raw?.proveedor === 'anthropic' && Array.isArray(m.raw.content)) {
        push('assistant', nonEmptyBlocks(m.raw.content));
        continue;
      }
      const blocks: Block[] = [];
      if (m.content.trim()) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
      push('assistant', blocks);
    } else {
      push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]);
    }
  }

  // La conversación debe empezar en user.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export const anthropicTranslator: Translator = {
  build(input: ChatInput, cfg: AiConfig): HttpRequest {
    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      messages: buildMessages(input),
    };
    const system = systemBlocks(input);
    if (system.length) body.system = system;
    if (input.tools.length) {
      body.tools = input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }
    return {
      url: `${cfg.baseUrl}/messages`,
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body,
    };
  },

  parse(json: unknown): ChatResult {
    const j = (json ?? {}) as {
      content?: Block[];
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    const blocks = Array.isArray(j.content) ? j.content : [];
    const texto = blocks
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
    const llamadas: ToolCall[] = blocks
      .filter((b) => b?.type === 'tool_use' && typeof b.name === 'string')
      .map((b, i) => ({
        id: typeof b.id === 'string' ? b.id : `toolu_local_${i}`,
        name: b.name as string,
        args: b.input && typeof b.input === 'object' && !Array.isArray(b.input) ? (b.input as Record<string, unknown>) : {},
      }));
    const u = j.usage ?? {};
    const raw = nonEmptyBlocks(blocks);

    return {
      texto,
      llamadas,
      fin: j.stop_reason ?? (blocks.length ? 'end_turn' : 'vacio'),
      uso: {
        entrada: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        salida: u.output_tokens ?? 0,
      },
      mensaje: {
        role: 'assistant',
        content: texto,
        ...(llamadas.length ? { toolCalls: llamadas } : {}),
        ...(raw.length ? { raw: { proveedor: 'anthropic', content: raw } } : {}),
      },
    };
  },
};

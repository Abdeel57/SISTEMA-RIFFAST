// Traductor OpenAI Chat Completions. Sirve para OpenAI y para todos los
// compatibles (OpenRouter, Groq, DeepSeek, xAI, Mistral, Cerebras, Ollama…).
import { parseToolArgs, systemText } from './history.js';
import type { AiConfig, ChatInput, ChatResult, HttpRequest, ToolCall, Translator } from './types.js';

type OpenAiMessage = Record<string, unknown>;

// reasoning_effort "low" en modelos de razonamiento de OpenAI (gpt-5*, o*,
// gpt-oss) cuando el proveedor lo acepta.
export function wantsLowReasoning(cfg: AiConfig): boolean {
  if (!['openai', 'groq', 'cerebras'].includes(cfg.provider)) return false;
  const name = cfg.model.split('/').pop()!.toLowerCase();
  return /^gpt-5/.test(name) || /^o\d/.test(name) || /^gpt-oss/.test(name);
}

function buildMessages(input: ChatInput, cfg: AiConfig): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  const sys = systemText(input.system);
  if (sys) out.push({ role: 'system', content: sys });

  for (const m of input.messages) {
    if (m.role === 'user') {
      if (m.images?.length) {
        const parts: Record<string, unknown>[] = [];
        if (m.content.trim()) parts.push({ type: 'text', text: m.content });
        for (const img of m.images) {
          parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
        }
        out.push({ role: 'user', content: parts });
      } else {
        out.push({ role: 'user', content: m.content });
      }
    } else if (m.role === 'assistant') {
      // content: '' (no null) cuando solo hay tool_calls: algunos compatibles rechazan null.
      const msg: OpenAiMessage = { role: 'assistant', content: m.content ?? '' };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
        }));
      }
      // OpenRouter: los modelos con razonamiento necesitan sus reasoning_details de vuelta.
      if (cfg.provider === 'openrouter' && m.raw?.proveedor === 'openrouter' && m.raw.reasoning_details) {
        msg.reasoning_details = m.raw.reasoning_details;
      }
      out.push(msg);
    } else {
      const msg: OpenAiMessage = { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      if (cfg.provider === 'mistral') msg.name = m.name;
      out.push(msg);
    }
  }
  return out;
}

export const openAiTranslator: Translator = {
  build(input: ChatInput, cfg: AiConfig): HttpRequest {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: buildMessages(input, cfg),
    };
    if (input.tools.length) {
      body.tools = input.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    // OpenAI oficial: los modelos nuevos rechazan max_tokens.
    if (cfg.provider === 'openai') body.max_completion_tokens = cfg.maxTokens;
    else body.max_tokens = cfg.maxTokens;
    if (wantsLowReasoning(cfg)) body.reasoning_effort = 'low';

    const headers: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}` };
    if (cfg.provider === 'openrouter') headers['X-Title'] = cfg.appName;

    return { url: `${cfg.baseUrl}/chat/completions`, headers, body };
  },

  parse(json: unknown, cfg: AiConfig): ChatResult {
    const j = (json ?? {}) as {
      choices?: { message?: Record<string, unknown>; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = j.choices?.[0];
    const msg = (choice?.message ?? {}) as {
      content?: unknown;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[];
      reasoning_details?: unknown;
    };

    let texto = '';
    if (typeof msg.content === 'string') texto = msg.content;
    else if (Array.isArray(msg.content)) {
      texto = msg.content
        .map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))
        .join('');
    }

    const llamadas: ToolCall[] = (msg.tool_calls ?? [])
      .filter((c) => c?.function?.name)
      .map((c, i) => {
        const { args, invalid } = parseToolArgs(c.function!.arguments);
        const call: ToolCall = { id: c.id || `call_${Date.now().toString(36)}_${i}`, name: c.function!.name!, args };
        if (invalid !== undefined) call.invalidArgs = invalid;
        return call;
      });

    const raw: Record<string, unknown> | undefined =
      cfg.provider === 'openrouter' && msg.reasoning_details
        ? { proveedor: 'openrouter', reasoning_details: msg.reasoning_details }
        : undefined;

    return {
      texto,
      llamadas,
      fin: choice?.finish_reason ?? (choice ? 'stop' : 'vacio'),
      uso: { entrada: j.usage?.prompt_tokens ?? 0, salida: j.usage?.completion_tokens ?? 0 },
      mensaje: {
        role: 'assistant',
        content: texto,
        ...(llamadas.length ? { toolCalls: llamadas } : {}),
        ...(raw ? { raw: raw as { proveedor: string } } : {}),
      },
    };
  },

  // Groq a veces responde 400 tool_use_failed cuando el modelo arma mal una
  // llamada; un reintento suele bastar.
  retryableBody(status: number, body: unknown): boolean {
    if (status !== 400 || !body || typeof body !== 'object') return false;
    const err = (body as { error?: { code?: unknown } }).error;
    return !!err && typeof err === 'object' && err.code === 'tool_use_failed';
  },
};

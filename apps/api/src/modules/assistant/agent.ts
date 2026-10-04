// Bucle del agente: IA → herramientas → IA, con un máximo de pasos por mensaje.
import type { AiClient } from './ai/client.js';
import { AiError } from './ai/http.js';
import type { AssistantMessage, NeutralMessage, SystemPrompt, ToolCall, ToolDef, ToolMessage, Usage } from './ai/types.js';

export const MAX_STEPS = 6;
export const EMPTY_REPLY = 'Perdón, no te entendí bien. ¿Me lo escribes de otra forma?';
export const STEPS_EXHAUSTED =
  'Me está costando resolver esto por aquí. Si te urge, toca **Pedir llamada** y alguien del equipo te contacta.';

export interface NewMessage {
  message: NeutralMessage;
  uso?: Usage;
}

export interface AgentResult {
  texto: string;
  nuevos: NewMessage[]; // mensajes del asistente y de herramientas de esta vuelta
  pasosAgotados: boolean;
  vacio: boolean; // la IA no dio texto final (se usó un respaldo)
}

// Error de la IA a media vuelta: trae lo que ya se hizo (p. ej. una tarjeta creada).
export class AgentError extends Error {
  cause: AiError;
  parcial: NewMessage[];
  constructor(cause: AiError, parcial: NewMessage[]) {
    super(cause.message);
    this.name = 'AgentError';
    this.cause = cause;
    this.parcial = parcial;
  }
}

export interface AgentInput {
  client: AiClient;
  system: SystemPrompt;
  history: NeutralMessage[]; // ya incluye el mensaje nuevo del usuario
  tools: ToolDef[];
  execTool: (call: ToolCall) => Promise<unknown>;
  maxSteps?: number;
  // Texto cuando la IA responde vacío dos veces (p. ej. "revisa la tarjeta").
  emptyFallback?: () => string;
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const maxSteps = input.maxSteps ?? MAX_STEPS;
  const messages = [...input.history];
  const nuevos: NewMessage[] = [];
  const textos: string[] = [];
  let retriedEmpty = false;

  const push = (message: NeutralMessage, uso?: Usage) => {
    messages.push(message);
    nuevos.push({ message, uso });
  };

  for (let step = 0; step < maxSteps; step++) {
    let res;
    try {
      res = await input.client.chat({ system: input.system, messages, tools: input.tools });
    } catch (err) {
      const aiErr = err instanceof AiError ? err : new AiError('proveedor', (err as Error)?.message ?? 'Error desconocido');
      throw new AgentError(aiErr, nuevos);
    }

    if (res.llamadas.length === 0) {
      if (!res.texto.trim()) {
        // Respuesta vacía: se reintenta una vez.
        if (!retriedEmpty) {
          retriedEmpty = true;
          continue;
        }
        if (textos.length) return { texto: textos.join('\n\n'), nuevos, pasosAgotados: false, vacio: true };
        const fallback = input.emptyFallback?.() ?? EMPTY_REPLY;
        push({ role: 'assistant', content: fallback }, res.uso);
        return { texto: fallback, nuevos, pasosAgotados: false, vacio: true };
      }
      push(res.mensaje, res.uso);
      textos.push(res.texto.trim());
      return { texto: textos.join('\n\n'), nuevos, pasosAgotados: false, vacio: false };
    }

    // Texto antes de usar herramientas: también se muestra.
    push(res.mensaje, res.uso);
    if (res.texto.trim()) textos.push(res.texto.trim());

    for (const call of res.llamadas) {
      let result: unknown;
      try {
        result = await input.execTool(call);
      } catch (err) {
        result = { ok: false, error: `La herramienta falló: ${(err as Error)?.message ?? 'error'}` };
      }
      const toolMsg: ToolMessage = { role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result ?? null) };
      push(toolMsg);
    }
  }

  // Se acabaron los pasos: mensaje amable que ofrece la llamada.
  const final: AssistantMessage = { role: 'assistant', content: STEPS_EXHAUSTED };
  push(final);
  return { texto: [...textos, STEPS_EXHAUSTED].join('\n\n'), nuevos, pasosAgotados: true, vacio: false };
}

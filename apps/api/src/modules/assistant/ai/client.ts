// Cliente de IA multi-proveedor con UNA sola variable (AI_API_KEY). Usa fetch
// nativo (sin SDKs) y tres traductores: OpenAI Chat Completions (todos los
// compatibles), Anthropic Messages y Gemini generateContent.
import { anthropicTranslator } from './anthropic.js';
import { describeConfig, resolveAiConfig } from './config.js';
import { geminiTranslator } from './gemini.js';
import { prepareMessages } from './history.js';
import { AiError, defaultHttpDeps, postJson, type HttpDeps } from './http.js';
import { openAiTranslator } from './openai.js';
import type { AiConfig, ChatInput, ChatResult, Translator, WireFormat } from './types.js';

const TRANSLATORS: Record<WireFormat, Translator> = {
  openai: openAiTranslator,
  anthropic: anthropicTranslator,
  gemini: geminiTranslator,
};

export interface AiClient {
  config: AiConfig;
  chat(input: ChatInput): Promise<ChatResult>;
}

export function createAiClient(config: AiConfig, deps: HttpDeps = defaultHttpDeps): AiClient {
  const translator = TRANSLATORS[config.format];
  return {
    config,
    async chat(input: ChatInput): Promise<ChatResult> {
      // Recorte del historial (24 mensajes sin partir pares) e imágenes si el
      // modelo no las lee: igual para todos los proveedores.
      const messages = prepareMessages(input.messages, config.vision);
      const req = translator.build({ ...input, messages }, config);
      const json = await postJson(
        req.url,
        req.headers,
        req.body,
        { timeoutMs: config.timeoutMs, model: config.model, retryableBody: translator.retryableBody },
        deps,
      );
      return translator.parse(json, config);
    },
  };
}

// ── Estado del cliente a partir del entorno ──────────────────────────
export interface AiStatus {
  // Hay AI_API_KEY: el chat se muestra (aunque la configuración falle, para
  // poder avisar al equipo y ofrecer la llamada).
  configured: boolean;
  client: AiClient | null;
  error: AiError | null;
}

let cached: AiStatus | null = null;

export function loadAiStatus(env: Record<string, string | undefined> = process.env, deps?: HttpDeps): AiStatus {
  try {
    const cfg = resolveAiConfig(env);
    if (!cfg) return { configured: false, client: null, error: null };
    return { configured: true, client: createAiClient(cfg, deps), error: null };
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError('config', (err as Error).message);
    return { configured: true, client: null, error: e };
  }
}

export function getAiStatus(): AiStatus {
  if (!cached) cached = loadAiStatus();
  return cached;
}

// Sin clave devuelve null. Con configuración inválida lanza AiError('config').
export function getAiClient(): AiClient | null {
  const s = getAiStatus();
  if (s.error) throw s.error;
  return s.client;
}

// Solo para pruebas.
export function setAiStatusForTests(status: AiStatus | null): void {
  cached = status;
}

// Línea para los logs de arranque (nunca incluye la clave).
export function describeAiStatus(s: AiStatus = getAiStatus()): string {
  if (!s.configured) return 'Asistencia 24 h: chat con IA desactivado (sin AI_API_KEY).';
  if (s.error) return `Asistencia 24 h: configuración de IA inválida → ${s.error.message}`;
  return `Asistencia 24 h: IA lista (${describeConfig(s.client!.config)}).`;
}

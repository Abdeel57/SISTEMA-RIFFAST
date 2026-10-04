// Configuración del cliente de IA a partir de UNA sola variable: AI_API_KEY.
// El proveedor se detecta por el prefijo de la clave; todo lo demás es opcional:
//   AI_PROVIDER (forzar proveedor), AI_MODEL, AI_BASE_URL (con AI_PROVIDER=compatible
//   o para cambiar la URL de cualquiera), AI_VISION=true|false, AI_MAX_TOKENS,
//   AI_TIMEOUT_MS.
import { AiError } from './http.js';
import type { AiConfig, ProviderId, WireFormat } from './types.js';

interface ProviderInfo {
  format: WireFormat;
  baseUrl: string;
  model: string; // modelo por defecto (revisado en octubre de 2026)
  vision: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: { format: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5-20251001', vision: true },
  openrouter: { format: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-3.1-flash-lite', vision: true },
  gemini: { format: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.1-flash-lite', vision: true },
  groq: { format: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', vision: false },
  xai: { format: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-4-1-fast-non-reasoning', vision: true },
  cerebras: { format: 'openai', baseUrl: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', vision: false },
  deepseek: { format: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', vision: false },
  openai: { format: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini', vision: true },
  // Mistral no se detecta por prefijo: se usa con AI_PROVIDER=mistral.
  // Visión apagada por defecto; actívala con AI_VISION=true si tu modelo la tiene.
  mistral: { format: 'openai', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', vision: false },
  // Cualquier API compatible con OpenAI (Ollama, Together, Fireworks…): exige
  // AI_BASE_URL y AI_MODEL.
  compatible: { format: 'openai', baseUrl: '', model: '', vision: false },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

const PROVIDER_LIST = 'anthropic, openai, gemini, openrouter, groq, deepseek, xai, mistral, cerebras, compatible';

// Detección por prefijo, en este orden (sk-ant- y sk-or- antes que sk-).
export function detectProvider(apiKey: string): ProviderId | null {
  const k = apiKey.trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('csk-')) return 'cerebras';
  if (/^sk-[0-9a-f]{32}$/i.test(k)) return 'deepseek';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

function parseBool(v: string | undefined): boolean | null {
  if (v === undefined || v.trim() === '') return null;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return null;
}

function parsePositiveInt(v: string | undefined, fallback: number, name: string): number {
  if (v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new AiError('config', `${name} debe ser un número entero mayor a 0.`);
  return n;
}

type Env = Record<string, string | undefined>;

// Devuelve null si no hay clave (el asistente queda apagado). Lanza AiError
// 'config' si la configuración está incompleta o no se reconoce.
export function resolveAiConfig(env: Env = process.env): AiConfig | null {
  const apiKey = (env.AI_API_KEY ?? '').trim();
  if (!apiKey) return null;

  const forced = (env.AI_PROVIDER ?? '').trim().toLowerCase();
  let provider: ProviderId;
  if (forced) {
    if (!(PROVIDER_IDS as string[]).includes(forced)) {
      throw new AiError('config', `AI_PROVIDER="${forced}" no es válido. Usa uno de: ${PROVIDER_LIST}.`);
    }
    provider = forced as ProviderId;
  } else {
    const detected = detectProvider(apiKey);
    if (!detected) {
      throw new AiError(
        'config',
        `No reconozco el tipo de AI_API_KEY por su prefijo. Pon AI_PROVIDER con uno de: ${PROVIDER_LIST}.`,
      );
    }
    provider = detected;
  }

  const info = PROVIDERS[provider];
  const baseUrl = ((env.AI_BASE_URL ?? '').trim() || info.baseUrl).replace(/\/+$/, '');
  const model = (env.AI_MODEL ?? '').trim() || info.model;

  if (provider === 'compatible' && !baseUrl) {
    throw new AiError('config', 'Con AI_PROVIDER=compatible tienes que poner AI_BASE_URL (p. ej. http://localhost:11434/v1).');
  }
  if (!model) throw new AiError('config', `Falta el modelo: pon AI_MODEL para el proveedor "${provider}".`);

  const vision = parseBool(env.AI_VISION) ?? info.vision;

  return {
    provider,
    format: info.format,
    apiKey,
    model,
    baseUrl,
    vision,
    maxTokens: parsePositiveInt(env.AI_MAX_TOKENS, 2048, 'AI_MAX_TOKENS'),
    timeoutMs: parsePositiveInt(env.AI_TIMEOUT_MS, 60_000, 'AI_TIMEOUT_MS'),
    appName: (env.ASISTENTE_MARCA ?? '').trim() || 'Riffast',
  };
}

// Descripción para los logs de arranque (sin la clave).
export function describeConfig(cfg: AiConfig): string {
  return `proveedor=${cfg.provider} modelo=${cfg.model} imágenes=${cfg.vision ? 'sí' : 'no'} url=${cfg.baseUrl}`;
}

// Capa de red del cliente de IA: fetch nativo con timeout, reintentos y errores
// tipificados. Nunca incluye la clave en mensajes ni logs.

export type AiErrorType = 'clave' | 'modelo' | 'limite' | 'proveedor' | 'red' | 'config';

export class AiError extends Error {
  tipo: AiErrorType;
  status?: number;
  constructor(tipo: AiErrorType, message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.tipo = tipo;
    this.status = status;
  }
}

export interface HttpDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export const defaultHttpDeps: HttpDeps = {
  fetch: (...args) => globalThis.fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export interface PostOptions {
  timeoutMs: number;
  model: string;
  retries?: number; // reintentos además del primer intento (default 2)
  retryableBody?: (status: number, body: unknown) => boolean;
}

const RETRY_STATUS = new Set([408, 425, 429, 529]);
const MAX_RETRY_AFTER_MS = 8_000;

// retry-after puede venir en segundos o como fecha HTTP.
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return null;
}

// Algunos proveedores repiten parte de la clave en el error ("Incorrect API key
// provided: sk-abc…"). Se oculta antes de que llegue a cualquier log.
export function redactKeys(text: string): string {
  return text.replace(/\b(sk-ant-|sk-or-|sk-|AIza|gsk_|xai-|csk-)[A-Za-z0-9_\-*.]{4,}/g, '[clave oculta]');
}

// Mensaje de error del proveedor (para logs y para clasificar). Los proveedores
// usan formas distintas: { error: { message } }, { error: 'texto' }, [{ error }].
export function providerErrorMessage(body: unknown): string {
  const b = Array.isArray(body) ? body[0] : body;
  let msg = '';
  if (typeof b === 'string') msg = b;
  else if (b && typeof b === 'object') {
    const err = (b as { error?: unknown }).error;
    const nested = err && typeof err === 'object' ? (err as { message?: unknown }).message : undefined;
    const top = (b as { message?: unknown }).message;
    if (typeof err === 'string') msg = err;
    else if (typeof nested === 'string') msg = nested;
    else if (typeof top === 'string') msg = top;
  }
  return redactKeys(msg).slice(0, 300);
}

export function classifyHttpError(status: number, body: unknown, model: string): AiError {
  const detail = providerErrorMessage(body);
  if (status === 401 || status === 403 || (status === 400 && /api key not valid|invalid api key|api_key_invalid/i.test(detail))) {
    return new AiError('clave', `La clave de IA no es válida o no tiene permiso (HTTP ${status}). Revisa AI_API_KEY.${detail ? ` Detalle: ${detail}` : ''}`, status);
  }
  if (status === 404) {
    return new AiError(
      'modelo',
      `El modelo "${model}" no existe o tu clave no tiene acceso a él: pon AI_MODEL con un modelo válido.${detail ? ` Detalle: ${detail}` : ''}`,
      status,
    );
  }
  if (status === 429) {
    return new AiError('limite', `El proveedor de IA rechazó la petición por límite de uso o saldo (HTTP 429).${detail ? ` Detalle: ${detail}` : ''}`, status);
  }
  if (status >= 500) {
    return new AiError('proveedor', `El proveedor de IA falló (HTTP ${status}).${detail ? ` Detalle: ${detail}` : ''}`, status);
  }
  return new AiError('proveedor', `El proveedor de IA rechazó la petición (HTTP ${status}).${detail ? ` Detalle: ${detail}` : ''}`, status);
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// POST JSON con timeout (AbortController) y hasta `retries` reintentos en 408,
// 425, 429, 5xx, 529 y errores 4xx marcados como reintentables. Respeta
// retry-after hasta 8 s; si el proveedor pide esperar más, falla con `limite`.
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: PostOptions,
  deps: HttpDeps = defaultHttpDeps,
): Promise<unknown> {
  const retries = opts.retries ?? 2;
  const payload = JSON.stringify(body);

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res: Response;
    try {
      res = await deps.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: payload,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = controller.signal.aborted || (err as Error)?.name === 'AbortError';
      throw new AiError(
        'red',
        aborted
          ? `El proveedor de IA no respondió en ${Math.round(opts.timeoutMs / 1000)} s (timeout).`
          : `No hubo conexión con el proveedor de IA: ${(err as Error)?.message ?? 'error de red'}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await readBody(res);
    } catch {
      parsed = null;
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) return parsed;

    const retryable =
      RETRY_STATUS.has(res.status) ||
      res.status >= 500 ||
      (opts.retryableBody ? opts.retryableBody(res.status, parsed) : false);

    if (!retryable || attempt >= retries) throw classifyHttpError(res.status, parsed, opts.model);

    const wait = parseRetryAfter(res.headers.get('retry-after'));
    if (wait !== null && wait > MAX_RETRY_AFTER_MS) {
      throw new AiError(
        'limite',
        `El proveedor de IA pidió esperar ${Math.round(wait / 1000)} s antes de reintentar (HTTP ${res.status}).`,
        res.status,
      );
    }
    await deps.sleep(wait ?? 500 * 2 ** attempt);
  }
}

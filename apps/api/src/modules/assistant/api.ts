// El asistente actúa EXACTAMENTE como si el rifero tocara los botones: llama a
// la propia API (app.inject) reenviando su sesión. Así pasan por los mismos
// hooks, permisos, validaciones y efectos (bitácora, tiempo real) sin duplicar
// lógica de negocio.
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface ApiResponse {
  status: number;
  body: unknown;
}

export type ApiCaller = (method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) => Promise<ApiResponse>;

export function injectCaller(app: FastifyInstance, request: FastifyRequest): ApiCaller {
  // Solo viajan las credenciales del usuario (cookie o Bearer).
  const headers: Record<string, string> = {};
  if (typeof request.headers.cookie === 'string') headers.cookie = request.headers.cookie;
  if (typeof request.headers.authorization === 'string') headers.authorization = request.headers.authorization;

  return async (method, path, body) => {
    const res = await app.inject({
      method,
      url: `/api${path}`,
      headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      payload: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let parsed: unknown = null;
    try {
      parsed = res.body ? JSON.parse(res.body) : null;
    } catch {
      parsed = res.body;
    }
    return { status: res.statusCode, body: parsed };
  };
}

// Error de la API traducido para el rifero. `technical` = no se le muestra el
// detalle (va a los logs).
export class ApiCallError extends Error {
  status: number;
  technical: boolean;
  detail: unknown;
  constructor(status: number, message: string, technical: boolean, detail: unknown) {
    super(message);
    this.name = 'ApiCallError';
    this.status = status;
    this.technical = technical;
    this.detail = detail;
  }
}

export const TECHNICAL_ERROR = 'Algo falló de nuestro lado y no se pudo completar. Intenta de nuevo en un momento.';

export function apiErrorMessage(status: number, body: unknown): { message: string; technical: boolean } {
  const b = (body ?? {}) as {
    error?: string;
    message?: string;
    details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
  };
  if (status >= 500 || b.error === 'internal_error') return { message: TECHNICAL_ERROR, technical: true };
  if (status === 401) return { message: 'Tu sesión expiró. Vuelve a iniciar sesión.', technical: false };
  // Validación Zod: el primer mensaje ya viene pensado para el rifero.
  const first = b.details?.formErrors?.[0] ?? Object.values(b.details?.fieldErrors ?? {}).find((v) => v && v.length)?.[0];
  if (b.message === 'Datos inválidos' && first) return { message: first, technical: false };
  if (typeof b.message === 'string' && b.message) return { message: b.message, technical: false };
  return { message: TECHNICAL_ERROR, technical: true };
}

export async function callApi<T>(api: ApiCaller, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const res = await api(method, path, body);
  if (res.status >= 400) {
    const { message, technical } = apiErrorMessage(res.status, res.body);
    throw new ApiCallError(res.status, message, technical, res.body);
  }
  return res.body as T;
}

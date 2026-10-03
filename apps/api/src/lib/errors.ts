// Errores de dominio con código HTTP. El error-handler global los serializa.

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const unauthorized = (message = 'No autenticado') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'No autorizado') =>
  new AppError(403, 'forbidden', message);

export const notFound = (message = 'No encontrado') =>
  new AppError(404, 'not_found', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'conflict', message, details);

export const tooMany = (message = 'Demasiadas solicitudes') =>
  new AppError(429, 'too_many_requests', message);

export const planLimit = (message: string, details?: unknown) =>
  new AppError(402, 'plan_limit', message, details);

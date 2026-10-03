import type { z } from 'zod';
import { badRequest } from './errors.js';

// Valida un payload con un schema Zod; lanza AppError 400 con detalles si falla.
// Devuelve el tipo de SALIDA del schema (respeta .default(), transforms, etc.).
export function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest('Datos inválidos', result.error.flatten());
  }
  return result.data;
}

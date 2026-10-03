// Helpers locales del seed (evita acoplar el seed al bootstrap de la app).

export const PLAN_SLUGS = {
  BASIC: 'basico',
  PRO: 'pro',
  VERIFIED: 'verificado',
} as const;

export function formatTicketNumber(n: number, padding: number): string {
  return String(n).padStart(padding, '0');
}

// Código determinista para datos demo (idempotencia del seed).
export function newOrderCodeFallback(suffix: string): string {
  return `BSK-${suffix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;
}

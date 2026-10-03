import { env } from '../config/env.js';

// ¿El origen está permitido? Misma lógica que usa CORS: lista explícita
// (CORS_ORIGINS) más, opcionalmente, cualquier subdominio del dominio raíz
// (CORS_ROOT_DOMAIN). La comparten el plugin de CORS y el guard CSRF.
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  if (env.corsOrigins.includes(origin)) return true;
  if (env.corsRootDomain) {
    try {
      const host = new URL(origin).hostname;
      if (host === env.corsRootDomain || host.endsWith(`.${env.corsRootDomain}`)) return true;
    } catch {
      /* origin malformado */
    }
  }
  return false;
}

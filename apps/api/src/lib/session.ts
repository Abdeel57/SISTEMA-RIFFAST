import type { FastifyReply } from 'fastify';
import type { UserRole } from '@bismark/shared';
import { SESSION_COOKIE } from './auth.js';
import { env } from '../config/env.js';

export interface SessionData {
  sub: string;
  role: UserRole;
  riferoId: string | null;
}

// Firma el JWT y lo guarda en cookie httpOnly. Devuelve el token (por si el
// cliente usa Bearer).
export async function setSession(reply: FastifyReply, payload: SessionData): Promise<string> {
  const token = await reply.jwtSign(payload);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    domain: env.cookieDomain,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/', domain: env.cookieDomain });
}

import '@fastify/jwt';
import type { UserRole } from '@bismark/shared';

declare module 'fastify' {
  interface FastifyRequest {
    // Poblado por el preHandler authenticate(). undefined si no hay sesión.
    auth?: {
      userId: string;
      role: UserRole;
      riferoId: string | null;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: UserRole; riferoId?: string | null };
    user: { sub: string; role: UserRole; riferoId?: string | null };
  }
}

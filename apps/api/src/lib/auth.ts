import bcrypt from 'bcryptjs';
import type { UserRole } from '@bismark/shared';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Payload del JWT de sesión.
export interface SessionPayload {
  sub: string; // user id
  role: UserRole;
  riferoId?: string | null;
}

export const SESSION_COOKIE = 'bsk_session';

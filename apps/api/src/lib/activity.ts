import { prisma } from './prisma.js';

type ActivityType = 'AUTH' | 'RAFFLE' | 'ORDER' | 'TICKET' | 'PAYMENT' | 'SUBSCRIPTION' | 'ADMIN' | 'DRAW';

export interface LogActivityInput {
  userId?: string | null;
  type: ActivityType;
  action: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

// Registro de actividad best-effort: nunca debe romper el flujo principal.
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        action: input.action,
        meta: (input.meta ?? undefined) as object | undefined,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // swallow — el log no debe interrumpir la operación
  }
}

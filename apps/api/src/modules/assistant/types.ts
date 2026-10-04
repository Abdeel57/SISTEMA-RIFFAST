// Tipos del asistente (tarjetas, acciones, sesión).
import type { UserRole } from '@riffast/shared';

export type ActionStatus = 'pendiente' | 'ejecutando' | 'hecha' | 'cancelada' | 'expirada' | 'fallida';

export const ACTION_TTL_MS = 30 * 60_000;

// Sesión del panel: SIEMPRE sale de la cookie/JWT, nunca de la IA.
export interface SessionAuth {
  userId: string;
  role: UserRole;
  riferoId: string;
}

export const isAdminRole = (role: string): boolean => role === 'RIFERO' || role === 'SUPER_ADMIN';

export interface CardField {
  etiqueta: string;
  valor: string;
  destacado?: boolean; // números grandes y monoespaciados (tarjeta, CLABE, total)
}

export interface Link {
  texto: string;
  url: string; // interno (/admin/...) o absoluto
}

// Tarjeta de confirmación que ve el rifero antes de cualquier cambio.
export interface Card {
  titulo: string;
  campos: CardField[];
  avisos: string[];
  boton: string;
  riesgo: boolean;
  // Marcar pagado: WhatsApp con el boleto, se abre en el mismo toque de
  // «Confirmar» (igual que en Órdenes).
  whatsapp?: Link;
}

export interface ActionResult {
  ok: boolean;
  mensaje: string;
  enlace?: Link;
  whatsapp?: Link;
}

export interface ActionView {
  id: string;
  herramienta: string;
  tarjeta: Card;
  estado: ActionStatus;
  resultado: ActionResult | null;
  fecha: string;
}

export interface CallView {
  id: string;
  telefono: string; // formateado
  horario: string;
  fecha: string;
}

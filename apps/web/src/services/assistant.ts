import { apiFetch } from '@/lib/api';

// Contrato de /api/asistente (Asistencia 24 h con IA).

export interface CardField {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}

export interface ChatLink {
  texto: string;
  url: string;
}

export interface ActionCardData {
  titulo: string;
  campos: CardField[];
  avisos: string[];
  boton: string;
  riesgo: boolean;
  whatsapp?: ChatLink;
}

export type ActionStatus = 'pendiente' | 'ejecutando' | 'hecha' | 'cancelada' | 'expirada' | 'fallida';

export interface ActionView {
  id: string;
  herramienta: string;
  tarjeta: ActionCardData;
  estado: ActionStatus;
  resultado: { ok: boolean; mensaje: string; enlace?: ChatLink; whatsapp?: ChatLink } | null;
  fecha: string;
}

export interface CallView {
  id: string;
  telefono: string;
  horario: string;
  fecha: string;
}

export type ChatItem =
  | { tipo: 'mensaje'; id: string; rol: 'user' | 'assistant'; texto: string; fecha: string; fotos?: string[] }
  | ({ tipo: 'accion' } & ActionView)
  | ({ tipo: 'llamada' } & CallView);

export interface AssistantStatus {
  activo: boolean;
  imagenes: boolean;
  sugerencias: string[];
  telefono: string;
}

export interface MessageResponse {
  estado: 'ok' | 'inactivo' | 'limite' | 'error' | 'invalido';
  texto: string;
  acciones: ActionView[];
  llamada?: CallView;
  permitirLlamada?: boolean;
}

export interface ActionResponse {
  estado: ActionStatus;
  texto: string;
  accion: ActionView;
}

export interface OutgoingImage {
  mimeType: string;
  data: string; // base64
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
  } catch {
    return 'America/Mexico_City';
  }
}

export const assistantService = {
  status: () => apiFetch<AssistantStatus>('/asistente/estado'),
  conversation: () => apiFetch<{ items: ChatItem[] }>('/asistente/conversacion'),
  send: (body: { texto: string; imagenes: OutgoingImage[]; reintentar?: boolean }) =>
    apiFetch<MessageResponse>('/asistente/mensaje', {
      method: 'POST',
      body: { ...body, zonaHoraria: browserTimeZone() } as unknown as Record<string, unknown>,
    }),
  confirm: (id: string) =>
    apiFetch<ActionResponse>(`/asistente/acciones/${encodeURIComponent(id)}/confirmar`, {
      method: 'POST',
      body: { zonaHoraria: browserTimeZone() },
    }),
  cancel: (id: string) =>
    apiFetch<ActionResponse>(`/asistente/acciones/${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: {} }),
  requestCall: (telefono: string) =>
    apiFetch<{ ok: boolean; duplicada: boolean; llamada: CallView }>('/asistente/llamada', {
      method: 'POST',
      body: { telefono, zonaHoraria: browserTimeZone() },
    }),
  reset: () => apiFetch<{ ok: boolean }>('/asistente/nueva', { method: 'POST', body: {} }),
};

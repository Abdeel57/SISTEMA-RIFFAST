// Preparación del historial antes de cada llamada a la IA (común a todos los
// proveedores): recorte, limpieza de llamadas huérfanas e imágenes.
import type { AssistantMessage, NeutralMessage, SystemPrompt } from './types.js';

export const MAX_HISTORY = 24;
export const NO_VISION_NOTE = '[Mandó una imagen que no puedes ver. Pídele que escriba los datos.]';

// Quita llamadas a herramientas sin resultado y resultados sin llamada. Si a un
// mensaje del asistente se le quita una llamada, se descarta su `raw` (ya no
// coincide con lo que mandó el proveedor).
export function dropOrphanToolCalls(messages: NeutralMessage[]): NeutralMessage[] {
  const answered = new Set<string>();
  for (const m of messages) if (m.role === 'tool') answered.add(m.toolCallId);

  const out: NeutralMessage[] = [];
  const called = new Set<string>();
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const kept = m.toolCalls.filter((c) => answered.has(c.id));
      kept.forEach((c) => called.add(c.id));
      if (kept.length === m.toolCalls.length) {
        out.push(m);
        continue;
      }
      const next: AssistantMessage = { role: 'assistant', content: m.content };
      if (kept.length) next.toolCalls = kept;
      if (next.content.trim() || kept.length) out.push(next);
      continue;
    }
    if (m.role === 'tool' && !called.has(m.toolCallId)) continue;
    out.push(m);
  }
  return out;
}

// Últimos `max` mensajes sin partir pares llamada/resultado: el recorte siempre
// empieza en un mensaje del usuario.
export function trimHistory(messages: NeutralMessage[], max = MAX_HISTORY): NeutralMessage[] {
  const clean = dropOrphanToolCalls(messages);
  let start = Math.max(0, clean.length - max);
  while (start < clean.length && clean[start].role !== 'user') start++;
  if (start >= clean.length) {
    // No hay ningún mensaje del usuario en la ventana: se toma el último que exista.
    const lastUser = clean.map((m) => m.role).lastIndexOf('user');
    return lastUser >= 0 ? dropOrphanToolCalls(clean.slice(lastUser)) : [];
  }
  return dropOrphanToolCalls(clean.slice(start));
}

// Si el modelo no lee imágenes, se quitan y se avisa en el texto.
export function stripImages(messages: NeutralMessage[], vision: boolean): NeutralMessage[] {
  if (vision) return messages;
  return messages.map((m) => {
    if (m.role !== 'user' || !m.images?.length) return m;
    const content = m.content.trim() ? `${m.content}\n${NO_VISION_NOTE}` : NO_VISION_NOTE;
    return { role: 'user', content };
  });
}

export function prepareMessages(messages: NeutralMessage[], vision: boolean, max = MAX_HISTORY): NeutralMessage[] {
  return stripImages(trimHistory(messages, max), vision);
}

export function systemText(system: SystemPrompt): string {
  if (typeof system === 'string') return system;
  return [system.fijo, system.variable].filter((s) => s && s.trim()).join('\n\n');
}

// Parsea el JSON de los argumentos de una herramienta sin tronar.
export function parseToolArgs(raw: unknown): { args: Record<string, unknown>; invalid?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { args: raw as Record<string, unknown> };
  if (raw === undefined || raw === null || raw === '') return { args: {} };
  if (typeof raw !== 'string') return { args: {}, invalid: String(raw) };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { args: parsed as Record<string, unknown> };
    return { args: {}, invalid: raw };
  } catch {
    return { args: {}, invalid: raw };
  }
}

// Interpreta el contenido de un mensaje `tool` (JSON en texto).
export function parseToolContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

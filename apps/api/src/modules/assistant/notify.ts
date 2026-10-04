// Avisos al equipo: Telegram (gratis y llega al celular al instante) y un
// webhook opcional (WhatsApp, Make, n8n, CRM). Sin canal configurado queda un
// aviso en los logs. Un aviso que falla NUNCA rompe el chat.
import { fullDate, formatPhone } from './format.js';
import type { AssistantSettings } from './settings.js';

export interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export interface TeamAlert {
  tipo: 'llamada' | 'reporte' | 'ia_caida';
  texto: string;
  datos: Record<string, unknown>;
}

export interface Notifier {
  send(alert: TeamAlert): Promise<void>;
}

const TEAM_TZ = 'America/Mexico_City';
const NOTIFY_TIMEOUT_MS = 8_000;

async function post(fetchImpl: typeof fetch, url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

export function createNotifier(
  settings: () => AssistantSettings,
  log: Logger,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Notifier {
  return {
    async send(alert) {
      const s = settings();
      const jobs: Promise<void>[] = [];
      if (s.telegramToken && s.telegramChatId) {
        jobs.push(
          post(fetchImpl, `https://api.telegram.org/bot${s.telegramToken}/sendMessage`, {
            chat_id: s.telegramChatId,
            text: alert.texto,
            disable_web_page_preview: true,
          }).catch((err) => log.error({ err: (err as Error).message, tipo: alert.tipo }, 'Asistente: no se pudo avisar por Telegram')),
        );
      }
      if (s.webhookUrl) {
        jobs.push(
          post(fetchImpl, s.webhookUrl, { tipo: alert.tipo, texto: alert.texto, ...alert.datos }).catch((err) =>
            log.error({ err: (err as Error).message, tipo: alert.tipo }, 'Asistente: no se pudo avisar al webhook'),
          ),
        );
      }
      if (!jobs.length) {
        log.warn({ aviso: alert.texto }, 'Asistente: aviso al equipo sin canal configurado (pon TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID)');
        return;
      }
      await Promise.all(jobs);
    },
  };
}

// Máximo un aviso por hora por tipo de error de IA.
export function createAlertThrottle(windowMs = 60 * 60_000, now: () => number = Date.now) {
  const last = new Map<string, number>();
  return {
    shouldSend(key: string): boolean {
      const t = now();
      const prev = last.get(key);
      if (prev !== undefined && t - prev < windowMs) return false;
      last.set(key, t);
      return true;
    },
  };
}

// ── Textos ─────────────────────────────────────────────────────────
export interface ClientInfo {
  cliente: string; // nombre de la página + quién escribe
  pagina: string; // URL de la página
}

export function callAlertText(
  marca: string,
  c: ClientInfo,
  call: { phone: string; reason: string; urgency: string; attempted: string | null; at: Date },
): string {
  const title = call.urgency === 'alta' ? `📞 LLAMADA URGENTE · ${marca}` : `📞 LLAMADA (urgencia media) · ${marca}`;
  return [
    title,
    `Cliente: ${c.cliente}`,
    `Página: ${c.pagina}`,
    `Tel: ${formatPhone(call.phone)}`,
    `Motivo: ${call.reason}`,
    `Ya se intentó: ${call.attempted?.trim() || 'nada aún'}`,
    `Pidió: ${fullDate(call.at, TEAM_TZ)} (hora del centro)`,
  ].join('\n');
}

const REPORT_LABEL: Record<string, string> = {
  falla: 'Falla',
  duda_sin_resolver: 'Duda sin resolver',
  sugerencia: 'Sugerencia',
};

export function reportAlertText(marca: string, c: ClientInfo, r: { type: string; description: string; at: Date }): string {
  return [
    `📝 REPORTE · ${marca}`,
    `Tipo: ${REPORT_LABEL[r.type] ?? r.type}`,
    `Cliente: ${c.cliente}`,
    `Página: ${c.pagina}`,
    `Descripción: ${r.description}`,
    `Fecha: ${fullDate(r.at, TEAM_TZ)} (hora del centro)`,
  ].join('\n');
}

export function aiDownAlertText(marca: string, c: ClientInfo, e: { tipo: string; detalle: string; at: Date }): string {
  return [
    `⚠️ IA CAÍDA · ${marca}`,
    `Cliente: ${c.cliente}`,
    `Página: ${c.pagina}`,
    `Error: ${e.tipo} — ${e.detalle}`,
    `Fecha: ${fullDate(e.at, TEAM_TZ)} (hora del centro)`,
    'Revisa AI_API_KEY, saldo o límites del proveedor. Mientras tanto el chat ofrece «Pedir llamada».',
  ].join('\n');
}

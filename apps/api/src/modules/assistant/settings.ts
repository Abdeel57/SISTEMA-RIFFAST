// Variables de entorno del asistente (además de las AI_* del cliente de IA).
// Se leen al usarse para que las pruebas puedan cambiarlas.

type Env = Record<string, string | undefined>;

export interface AssistantSettings {
  marca: string;
  horarioLlamadas: string;
  limiteDiario: number;
  telegramToken: string;
  telegramChatId: string;
  webhookUrl: string;
  // URL pública del sitio para los avisos al equipo (si no hay petición a mano).
  siteUrl: string;
}

export function assistantSettings(env: Env = process.env): AssistantSettings {
  const limite = Number(env.ASISTENTE_LIMITE_DIARIO);
  const railwayDomain = (env.RAILWAY_PUBLIC_DOMAIN ?? '').trim();
  return {
    marca: (env.ASISTENTE_MARCA ?? '').trim() || 'Riffast',
    horarioLlamadas: (env.ASISTENTE_HORARIO_LLAMADAS ?? '').trim() || 'de 9:00 a 21:00, hora del centro de México',
    limiteDiario: Number.isInteger(limite) && limite > 0 ? limite : 150,
    telegramToken: (env.TELEGRAM_BOT_TOKEN ?? '').trim(),
    telegramChatId: (env.TELEGRAM_CHAT_ID ?? '').trim(),
    webhookUrl: (env.ASISTENTE_WEBHOOK_URL ?? '').trim(),
    siteUrl: ((env.PUBLIC_WEB_URL ?? '').trim() || (railwayDomain ? `https://${railwayDomain}` : '')).replace(/\/$/, ''),
  };
}

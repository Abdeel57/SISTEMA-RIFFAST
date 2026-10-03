// Web Push — avisos al rifero (organizador). SOLO organizadores reciben push.
// Sin claves VAPID el push queda desactivado (no-op). Best-effort: nunca lanza.

import webpush from 'web-push';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

let enabled = false;

if (env.push.vapidPublic && env.push.vapidPrivate) {
  try {
    webpush.setVapidDetails(env.push.vapidSubject, env.push.vapidPublic, env.push.vapidPrivate);
    enabled = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[push] claves VAPID inválidas:', (err as Error).message);
  }
}

export const pushEnabled = (): boolean => enabled;
export const vapidPublicKey = (): string => env.push.vapidPublic;

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Guarda/actualiza la suscripción de un usuario (upsert por endpoint).
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
  userAgent?: string,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// Envía un push a todos los dispositivos de un usuario. Limpia las muertas (404/410).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!enabled) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      }),
    );
  } catch {
    // best-effort: un fallo de push nunca rompe el flujo principal.
  }
}

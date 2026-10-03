// Cliente de Web Push — SOLO para riferos (organizadores).
// Consume el contrato C1: GET /push/public-key, POST /push/subscribe,
// POST /push/unsubscribe. El comprador NUNCA usa esto.
//
// El backend ya dispara push en nueva orden y comprobante subido; aquí solo
// gestionamos permiso + suscripción del navegador del rifero.
import { apiFetch } from '@/lib/api';

export type PushState = 'unsupported' | 'denied' | 'default' | 'subscribed' | 'unsubscribed';

/** ¿El navegador soporta push (SW + PushManager + Notification)? */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// VAPID base64url → ArrayBuffer para applicationServerKey (BufferSource).
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  // vite-plugin-pwa registra el SW (autoUpdate). Esperamos a que esté listo.
  return navigator.serviceWorker.ready;
}

/** Estado actual de la suscripción de este navegador. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await getRegistration();
  if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  if (sub) return 'subscribed';
  return Notification.permission === 'granted' ? 'unsubscribed' : 'default';
}

/**
 * Pide permiso (si hace falta), se suscribe con la VAPID key del backend y
 * envía la suscripción a /push/subscribe. Devuelve el estado resultante.
 * Lanza si el usuario deniega o si algo falla, para que la UI muestre el error.
 */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'default';
  }

  const reg = await getRegistration();
  if (!reg) return 'unsupported';

  // Reutiliza la suscripción existente si ya hay una.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { key } = await apiFetch<{ key: string }>('/push/public-key');
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(key),
    });
  }

  // El objeto PushSubscription se serializa con la forma { endpoint, keys{...} }.
  await apiFetch('/push/subscribe', { method: 'POST', body: sub.toJSON() as Record<string, unknown> });
  return 'subscribed';
}

/**
 * Desuscribe este navegador: notifica al backend y elimina la suscripción local.
 */
export async function disablePush(): Promise<PushState> {
  const reg = await getRegistration();
  if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Avisar al backend primero (best-effort), luego desuscribir localmente.
    try {
      await apiFetch('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
    } catch {
      /* el backend limpia suscripciones muertas solo; seguimos */
    }
    await sub.unsubscribe();
  }
  return 'unsubscribed';
}

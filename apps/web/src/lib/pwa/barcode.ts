// Soporte de escaneo de QR con la API nativa `BarcodeDetector` (sin dependencias).
// Disponible en Chrome/Edge Android y algunos navegadores de escritorio. Donde
// no exista, el consumidor debe ofrecer un fallback (entrada manual del folio).
//
// Los tipos no están en lib.dom, así que los declaramos de forma mínima aquí.

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

/** ¿El navegador soporta BarcodeDetector? */
export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && getCtor() !== null;
}

/** Crea un detector de QR, o null si la API no existe. */
export function createQrDetector(): BarcodeDetectorLike | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

/**
 * Extrae el folio de validación de un valor escaneado. Acepta tanto una URL
 * completa (`https://.../validar/ABC123`) como el folio a secas (`ABC123`).
 * Devuelve null si no reconoce nada usable.
 */
export function extractValidationCode(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // Buscar el patrón /validar/<code> dentro de una URL.
  const match = value.match(/\/(?:validar|boleto)\/([^/?#\s]+)/i);
  if (match) return decodeURIComponent(match[1]);
  // Si no parece URL y es un folio simple (alfanumérico/guiones), úsalo tal cual.
  if (/^[A-Za-z0-9_-]{4,}$/.test(value)) return value;
  return null;
}

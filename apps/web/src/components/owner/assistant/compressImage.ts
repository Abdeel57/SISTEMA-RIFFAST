// Comprime una foto en el navegador antes de mandarla al asistente: 1600 px el
// lado mayor, JPEG 0.85, con la orientación EXIF aplicada y fondo blanco (para
// PNG con transparencia).

export interface PreparedImage {
  mimeType: 'image/jpeg';
  data: string; // base64 sin prefijo
  preview: string; // data URL para la miniatura
}

const MAX_SIDE = 1600;
const QUALITY = 0.85;

type Drawable = { width: number; height: number; source: CanvasImageSource; close?: () => void };

async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close() };
    } catch {
      /* respaldo con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen'));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, source: img };
  } finally {
    // La imagen ya decodificada sigue sirviendo para dibujar.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una foto');
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no pudo procesar la foto');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la foto'))), 'image/jpeg', QUALITY),
    );
    const dataUrl = await blobToDataUrl(blob);
    return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1), preview: dataUrl };
  } finally {
    img.close?.();
  }
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { badRequest } from '../../lib/errors.js';
import { requireAuth } from '../../middlewares/auth.js';
import { storage } from '../../lib/storage.js';
import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, LIMITS } from '@bismark/shared';

const IMAGE_FOLDERS = new Set(['logos', 'covers', 'prizes', 'misc']);
const VIDEO_FOLDERS = new Set(['evidence', 'misc']);

interface Kind {
  allowed: readonly string[];
  maxBytes: number;
  folders: Set<string>;
  defaultFolder: string;
  label: string;
}

const KINDS: Record<'image' | 'video', Kind> = {
  image: { allowed: ALLOWED_IMAGE_MIME, maxBytes: LIMITS.imageMaxBytes, folders: IMAGE_FOLDERS, defaultFolder: 'misc', label: 'imagen' },
  video: { allowed: ALLOWED_VIDEO_MIME, maxBytes: LIMITS.videoMaxBytes, folders: VIDEO_FOLDERS, defaultFolder: 'evidence', label: 'video' },
};

async function handleUpload(request: FastifyRequest, reply: FastifyReply, kind: 'image' | 'video') {
  const k = KINDS[kind];
  const folderRaw = String((request.query as { folder?: string }).folder ?? k.defaultFolder);
  const folder = k.folders.has(folderRaw) ? folderRaw : k.defaultFolder;

  // Límite de tamaño por-petición (evita bufferizar archivos enormes).
  const file = await request.file({ limits: { fileSize: k.maxBytes } });
  if (!file) throw badRequest('No se recibió ningún archivo');
  if (!k.allowed.includes(file.mimetype)) {
    throw badRequest(`Formato de ${k.label} no permitido.`);
  }

  const buffer = await file.toBuffer();
  // @fastify/multipart marca truncated cuando se supera el límite (throwFileSizeLimit: false).
  if (file.file.truncated || buffer.byteLength > k.maxBytes) {
    const mb = Math.round(k.maxBytes / (1024 * 1024));
    throw badRequest(`El ${k.label} supera el tamaño máximo (${mb} MB).`);
  }

  const stored = await storage.upload({ buffer, filename: file.filename, mimetype: file.mimetype, folder });
  return reply.code(201).send({ url: stored.url, key: stored.key });
}

export default async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  // POST /uploads-api/image?folder=logos|covers|prizes|misc
  app.post(
    '/uploads-api/image',
    { preHandler: requireAuth, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
    (request, reply) => handleUpload(request, reply, 'image'),
  );

  // POST /uploads-api/video?folder=evidence  (evidencia/video del sorteo)
  app.post(
    '/uploads-api/video',
    { preHandler: requireAuth, config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
    (request, reply) => handleUpload(request, reply, 'video'),
  );
}

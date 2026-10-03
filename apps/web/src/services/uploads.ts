import { apiUpload } from '@/lib/api';

export type UploadFolder = 'logos' | 'covers' | 'prizes' | 'misc';
export type VideoFolder = 'evidence' | 'misc';

export const uploadService = {
  image: (file: File, folder: UploadFolder = 'misc') =>
    apiUpload<{ url: string; key: string }>('/uploads-api/image', file, { folder }),
  video: (file: File, folder: VideoFolder = 'evidence') =>
    apiUpload<{ url: string; key: string }>('/uploads-api/video', file, { folder }),
};

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const objectStorageClient = config.OBJECT_STORAGE_BUCKET
  ? new S3Client({
    region: config.OBJECT_STORAGE_REGION,
    endpoint: config.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  })
  : null;
const acceptedFormats = new Set(['jpeg', 'png', 'webp', 'avif']);
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxConcurrentUploadRequests = 2;
let activeUploadRequests = 0;

const fileFilter = (req, file, cb) => {
  if (acceptedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Only JPEG, PNG, WebP, and AVIF images are allowed');
    error.status = 400;
    cb(error);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 3,
    fields: 10,
    parts: 13,
    fieldSize: 32 * 1024,
  },
});

export function limitUploadConcurrency(req, res, next) {
  if (activeUploadRequests >= maxConcurrentUploadRequests) {
    return res.status(503).json({ error: 'Image processing capacity is currently full; try again shortly' });
  }

  activeUploadRequests++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeUploadRequests--;
  };
  res.once('finish', release);
  res.once('close', release);
  next();
}

export async function saveOptimizedImage(buffer) {
  let optimized;
  try {
    const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
    if (!acceptedFormats.has(metadata.format)) {
      const invalidImage = new Error('Only JPEG, PNG, WebP, and AVIF images are allowed');
      invalidImage.status = 400;
      throw invalidImage;
    }

    optimized = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    if (error.status) throw error;
    const invalidImage = new Error('Uploaded file is not a valid supported image');
    invalidImage.status = 400;
    invalidImage.cause = error;
    throw invalidImage;
  }

  const filename = `${uuid()}.webp`;
  if (config.NODE_ENV === 'production') {
    if (!objectStorageClient || !config.OBJECT_STORAGE_PUBLIC_URL) {
      throw new Error('Production object storage is not configured');
    }
    const key = `uploads/${filename}`;
    await objectStorageClient.send(new PutObjectCommand({
      Bucket: config.OBJECT_STORAGE_BUCKET,
      Key: key,
      Body: optimized,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return {
      filename,
      url: `${config.OBJECT_STORAGE_PUBLIC_URL.replace(/\/+$/, '')}/${key}`,
    };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), optimized, { flag: 'wx' });
  return { filename, url: `/uploads/${filename}` };
}

export async function removeUploadedImage(filename) {
  const safeFilename = path.basename(filename);
  if (config.NODE_ENV === 'production') {
    if (!objectStorageClient || !config.OBJECT_STORAGE_BUCKET) {
      throw new Error('Production object storage is not configured');
    }
    await objectStorageClient.send(new DeleteObjectCommand({
      Bucket: config.OBJECT_STORAGE_BUCKET,
      Key: `uploads/${safeFilename}`,
    }));
    return;
  }
  await fs.unlink(path.join(uploadDir, safeFilename));
}

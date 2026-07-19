import https from 'https';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import Logger from './logger';

/** Where downloaded return-unboxing videos are written. Not committed to git (see .gitignore) —
 * in a multi-instance or ephemeral-filesystem deployment (serverless, containers without a
 * persistent volume), swap this for object storage (S3 etc); local disk works for a single
 * long-running server, which is how this API is currently deployed. */
export function getReturnVideoStorageDir(): string {
  return config.returnVideoStorageDir || path.join(process.cwd(), 'uploads', 'return-videos');
}

function ensureStorageDir(): string {
  const dir = getReturnVideoStorageDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

interface MediaMeta {
  url: string;
  mimeType: string;
}

/** Step 1 of the Meta media download: exchange a media ID for a short-lived signed URL. */
function fetchMediaMeta(mediaId: string): Promise<MediaMeta> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: `/${config.whatsappApiVersion}/${mediaId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${config.whatsappToken}` },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`WhatsApp media lookup failed (${res.statusCode}): ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve({ url: parsed.url, mimeType: parsed.mime_type });
          } catch {
            reject(new Error('Invalid WhatsApp media metadata response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Step 2: download the actual bytes from the signed URL (also bearer-auth'd). */
function downloadMediaBytes(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { Authorization: `Bearer ${config.whatsappToken}` } }, (res) => {
      if ((res.statusCode ?? 0) >= 400) {
        reject(new Error(`WhatsApp media download failed (${res.statusCode})`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

const extensionForMime = (mimeType: string): string => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('3gpp')) return '3gp';
  return 'bin';
};

/**
 * Download a WhatsApp media message (by its media ID) and persist it under the
 * return-video storage directory. `filenameHint` (e.g. a return ID or "unmatched-<phone>")
 * keeps filenames traceable without leaking anything sensitive into the path.
 */
export async function downloadAndStoreWhatsAppMedia(
  mediaId: string,
  filenameHint: string,
): Promise<{ filePath: string; mimeType: string }> {
  if (!config.whatsappToken) {
    throw new Error('WHATSAPP_TOKEN not configured — cannot download media');
  }

  const meta = await fetchMediaMeta(mediaId);
  const bytes = await downloadMediaBytes(meta.url);

  const dir = ensureStorageDir();
  const fileName = `${filenameHint}-${Date.now()}.${extensionForMime(meta.mimeType)}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, bytes);

  Logger.info(`[whatsapp-media] stored ${bytes.length} bytes to ${filePath}`);
  return { filePath, mimeType: meta.mimeType };
}

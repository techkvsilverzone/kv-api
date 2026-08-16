import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { config } from '../../config';
import Logger from '../../utils/logger';

/**
 * Product image persistence.
 *
 * PostgreSQL stores only `product_images.image_url` — a public path Nginx
 * serves from `config.imageStorageRoot`. Binary image data never enters the
 * database and is never decoded on a read path (spec §13).
 *
 * The admin panel still uploads base64 data URIs, and that request contract is
 * preserved (spec §4). The decode/encode step that `src/migration/migrate-images.ts`
 * performed as a one-off therefore also lives on the write path: an incoming
 * data URI is converted to WebP, written to disk, and reduced to a URL before
 * it reaches the repository.
 */

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const WEBP_QUALITY = 82;

/** True when the value is already a stored reference rather than fresh binary. */
const isStoredReference = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith('/');

const parseDataUri = (value: string): { buffer: Buffer } | null => {
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);
  const base64 = match ? match[1].replace(/\s/g, '') : null;

  if (base64) {
    const buffer = Buffer.from(base64, 'base64');
    return buffer.length ? { buffer } : null;
  }

  // Raw base64 with no data-URI prefix — the admin panel has historically sent
  // both forms.
  const raw = value.replace(/\s/g, '');
  if (raw.length < 32 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null;

  const buffer = Buffer.from(raw, 'base64');
  return buffer.length ? { buffer } : null;
};

/**
 * Turn one incoming image value into a public URL.
 *
 * - An existing URL/path is returned untouched, so re-saving an entity that
 *   echoes back its current gallery does not rewrite files.
 * - Base64 is converted to WebP and written to disk.
 * - Anything unrecognised yields null and is dropped by the caller.
 *
 * `ownerPath` is the sub-directory under the storage root (a product id, or
 * `gift-vouchers/<id>`), `slot` disambiguates files within it, and the content
 * hash keeps a replacement from colliding with the image it replaces in a
 * browser cache.
 */
export const persistImage = async (
  ownerPath: string,
  slot: number,
  value: string,
): Promise<string | null> => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  if (isStoredReference(trimmed)) return trimmed;

  const parsed = parseDataUri(trimmed);
  if (!parsed) {
    Logger.error(`[images] unrecognised image payload for ${ownerPath} slot ${slot}`);
    return null;
  }

  const encoded = await sharp(parsed.buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const digest = crypto.createHash('sha256').update(encoded).digest('hex').slice(0, 8);
  const fileName = `${String(slot).padStart(3, '0')}-${digest}.webp`;
  const directory = path.join(config.imageStorageRoot, ...ownerPath.split('/'));

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, fileName), encoded);

  // Always forward slashes — this is a URL, not a filesystem path, and the API
  // may well be running on Windows during development.
  return `${config.imagePublicBase.replace(/\/+$/, '')}/${ownerPath}/${fileName}`;
};

/** Product gallery entry. Files live under `<root>/<productId>/`, matching the migrated layout. */
export const persistProductImage = (
  productId: string,
  slot: number,
  value: string,
): Promise<string | null> => persistImage(productId, slot, value);

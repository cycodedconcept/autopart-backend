const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const UPLOAD_HTACCESS = `php_flag engine off\nOptions -ExecCGI\nAddType text/plain .php .phtml .php3 .php4 .php5 .pl .py .cgi\n`;
const PRODUCT_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

function resolveUploadRoot(uploadRoot) {
  return path.resolve(process.cwd(), uploadRoot || './public_html/uploads');
}

function resolveUploadDirectory(uploadRoot) {
  return path.join(resolveUploadRoot(uploadRoot), 'products');
}

function resolveBlogImageDirectory(uploadRoot) {
  return path.join(resolveUploadRoot(uploadRoot), 'blog');
}

function ensureProductUploadDirectory(env) {
  const uploadRoot = resolveUploadRoot(env.UPLOAD_DIR);
  fs.mkdirSync(resolveUploadDirectory(env.UPLOAD_DIR), { recursive: true });
  fs.mkdirSync(resolveBlogImageDirectory(env.UPLOAD_DIR), { recursive: true });
  fs.writeFileSync(path.join(uploadRoot, '.htaccess'), UPLOAD_HTACCESS, 'utf8');
}

function getImageType(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function stripJpegExif(buffer) {
  const chunks = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return buffer;
    if (marker !== 0xe1) chunks.push(buffer.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  chunks.push(buffer.subarray(offset));
  return Buffer.concat(chunks);
}

function stripPngExif(buffer) {
  const chunks = [buffer.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return buffer;
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type !== 'eXIf') chunks.push(buffer.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}

function stripWebpExif(buffer) {
  const chunks = [buffer.subarray(0, 12)];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32LE(offset + 4);
    const paddedSize = size + (size % 2);
    const end = offset + 8 + paddedSize;
    if (end > buffer.length) return buffer;
    if (buffer.subarray(offset, offset + 4).toString('ascii') !== 'EXIF') chunks.push(buffer.subarray(offset, end));
    offset = end;
  }
  const stripped = Buffer.concat(chunks);
  stripped.writeUInt32LE(stripped.length - 8, 4);
  return stripped;
}

async function stripExif(filePath, imageType) {
  const buffer = await fsPromises.readFile(filePath);
  const stripped = imageType === 'image/jpeg' ? stripJpegExif(buffer)
    : imageType === 'image/png' ? stripPngExif(buffer)
      : stripWebpExif(buffer);
  await fsPromises.writeFile(filePath, stripped);
}

function thumbnailPath(filePath) {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}.thumb${extension}`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, (error) => (error ? reject(error) : resolve()));
  });
}

async function createThumbnail(filePath, logger) {
  const destination = thumbnailPath(filePath);
  try {
    // sharp is optional so cPanel deployments can use ImageMagick instead.
    // eslint-disable-next-line global-require
    const sharp = require('sharp');
    await sharp(filePath).rotate().resize({ width: 400, withoutEnlargement: true }).toFile(destination);
    return destination;
  } catch (sharpError) {
    try {
      await run('convert', [filePath, '-strip', '-resize', '400x400>', destination]);
      return destination;
    } catch (_imageMagickError) {
      logger.warn(`Thumbnail skipped for ${path.basename(filePath)}: sharp and ImageMagick are unavailable.`);
      return null;
    }
  }
}

function buildProductImageFilename(mimeType) {
  return `${crypto.randomBytes(16).toString('hex')}${PRODUCT_IMAGE_TYPES.get(mimeType)}`;
}

function buildProductImagePath(filename) {
  return `/uploads/products/${filename}`;
}

function buildBlogImagePath(filename) {
  return `/uploads/blog/${filename}`;
}

function resolveStoredBlogImagePath(env, storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.startsWith('/uploads/blog/')) return null;
  const filename = path.basename(storedPath);
  if (!/^[a-f0-9]{32}(?:\.thumb)?\.(?:jpg|png|webp)$/.test(filename)) return null;
  const directory = resolveBlogImageDirectory(env.UPLOAD_DIR);
  const resolved = path.resolve(directory, filename);
  return resolved.startsWith(`${directory}${path.sep}`) ? resolved : null;
}

function resolveStoredProductImagePath(env, storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.startsWith('/uploads/products/')) return null;
  const filename = path.basename(storedPath);
  if (!/^[a-f0-9]{32}(?:\.thumb)?\.(?:jpg|png|webp)$/.test(filename)) return null;
  const directory = resolveUploadDirectory(env.UPLOAD_DIR);
  const resolved = path.resolve(directory, filename);
  return resolved.startsWith(`${directory}${path.sep}`) ? resolved : null;
}

async function removeStoredProductImages(env, images = []) {
  await Promise.all(images.flatMap(({ url }) => {
    const filePath = resolveStoredProductImagePath(env, url);
    return filePath ? [filePath, thumbnailPath(filePath)] : [];
  }).map(async (filePath) => {
    try { await fsPromises.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }));
}

async function removeStoredBlogImage(env, storedPath) {
  const filePath = resolveStoredBlogImagePath(env, storedPath);
  if (!filePath) return;
  await Promise.all([filePath, thumbnailPath(filePath)].map(async (targetPath) => {
    try { await fsPromises.unlink(targetPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }));
}

function buildPublicUrl(baseUrl, storedPath) {
  if (!storedPath || /^https?:\/\//i.test(storedPath)) return storedPath;
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${storedPath}` : storedPath;
}

module.exports = {
  PRODUCT_IMAGE_TYPES,
  buildBlogImagePath,
  buildProductImageFilename,
  buildProductImagePath,
  buildPublicUrl,
  createThumbnail,
  ensureProductUploadDirectory,
  getImageType,
  removeStoredProductImages,
  removeStoredBlogImage,
  resolveBlogImageDirectory,
  resolveUploadDirectory,
  resolveUploadRoot,
  stripExif
};

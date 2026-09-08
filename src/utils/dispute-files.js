const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { resolveUploadRoot } = require('./product-image-files');

const DISPUTE_FILENAME_PATTERN = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;
const DISPUTE_DIRECTORY_RULES = 'Require all denied\n';

function ensureDisputeUploadDirectory(env) {
  const directory = path.join(resolveUploadRoot(env.UPLOAD_DIR), 'disputes');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Apache must honor AuthConfig overrides here, or use an equivalent Directory rule.
  fs.writeFileSync(path.join(directory, '.htaccess'), DISPUTE_DIRECTORY_RULES, 'utf8');
  return directory;
}

function disputeFilePath(filename) {
  return DISPUTE_FILENAME_PATTERN.test(filename) ? `disputes/${filename}` : null;
}

function disputeEvidenceUrl(filename) {
  return `/api/v1/dispute-evidence/${filename}`;
}

function resolveDisputeFile(env, storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.startsWith('disputes/')) return null;
  const filename = storedPath.slice('disputes/'.length);
  if (!DISPUTE_FILENAME_PATTERN.test(filename)) return null;
  return path.join(resolveUploadRoot(env.UPLOAD_DIR), storedPath);
}

async function removeDisputeFiles(env, files = []) {
  await Promise.all(files.map(async (file) => {
    const filePath = resolveDisputeFile(env, file.filePath);
    if (!filePath) return;
    try { await fsPromises.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }));
}

module.exports = { DISPUTE_FILENAME_PATTERN, disputeEvidenceUrl, disputeFilePath,
  ensureDisputeUploadDirectory, removeDisputeFiles, resolveDisputeFile };

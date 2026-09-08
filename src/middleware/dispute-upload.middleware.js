const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');
const { PRODUCT_IMAGE_TYPES, buildProductImageFilename, getImageType, stripExif } = require('../utils/product-image-files');
const { disputeFilePath, disputeEvidenceUrl, ensureDisputeUploadDirectory, removeDisputeFiles } = require('../utils/dispute-files');

function createDisputeUploadMiddleware({ env, fieldName = 'evidence' }) {
  const directory = ensureDisputeUploadDirectory(env);
  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, callback) { callback(null, directory); },
      filename(_req, file, callback) { callback(null, buildProductImageFilename(file.mimetype)); }
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 4, fieldSize: 16000 },
    fileFilter(_req, file, callback) {
      if (!PRODUCT_IMAGE_TYPES.has(file.mimetype)) return callback(new AppError(
        'Only jpeg, png, and webp files are allowed for dispute evidence.',
        { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR }
      ));
      return callback(null, true);
    }
  }).array(fieldName, 5);

  return (req, res, next) => upload(req, res, async (uploadError) => {
    req.disputeFiles = (req.files || []).map((file) => ({
      filename: file.filename, filePath: disputeFilePath(file.filename), url: disputeEvidenceUrl(file.filename)
    }));
    try {
      if (uploadError) throw uploadError;
      for (const file of req.files || []) {
        const actualType = getImageType(await fs.readFile(file.path));
        if (actualType !== file.mimetype) throw new AppError(
          'Dispute evidence contents do not match its declared image type.',
          { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR }
        );
        await stripExif(file.path, actualType);
      }
      return next();
    } catch (error) {
      if (error instanceof multer.MulterError) return next(new AppError(
        error.code === 'LIMIT_FILE_SIZE' ? 'Dispute evidence must be 5MB or smaller.'
          : 'Dispute evidence upload failed. Supply at most 5 images.',
        { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR }
      ));
      return next(error);
    }
  });
}

function createDisputeUploadCleanupMiddleware({ env, logger }) {
  // Route-local error cleanup also covers Joi validation and failed transactions.
  return async (error, req, res, next) => {
    try { await removeDisputeFiles(env, req.disputeFiles); } catch (cleanupError) {
      logger.error('Dispute upload cleanup failed.', { errorMessage: cleanupError.message });
    }
    next(error);
  };
}

function denyDisputeStaticFiles(req, res, next) {
  let decodedPath;
  try { decodedPath = decodeURIComponent(req.path); } catch (_error) {
    return next(new AppError('Invalid upload path.', { statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR }));
  }
  // Normalize the same encoded/dot paths static serving accepts before checking the directory.
  const normalized = path.posix.normalize(`/${decodedPath.replace(/\\/g, '/')}`).toLowerCase();
  if (normalized === '/disputes' || normalized.startsWith('/disputes/')) {
    return next(new AppError('Requested resource was not found.', { statusCode: 404, code: ERROR_CODES.NOT_FOUND }));
  }
  return next();
}

module.exports = { createDisputeUploadMiddleware, createDisputeUploadCleanupMiddleware, denyDisputeStaticFiles };

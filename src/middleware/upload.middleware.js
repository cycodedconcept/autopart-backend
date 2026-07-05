const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');

const ALLOWED_FILE_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png']
]);
const ALLOWED_PRODUCT_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png']
]);
const ALLOWED_CSV_TYPES = new Set([
  'application/csv',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain'
]);
const SELLER_DOCUMENT_FIELD_NAMES = ['cacDocument', 'proofOfAddressDocument'];
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_COUNT = 6;
const MAX_INVENTORY_CSV_SIZE_BYTES = 2 * 1024 * 1024;

function resolveUploadDirectory(uploadRoot) {
  if (path.isAbsolute(uploadRoot)) {
    return uploadRoot;
  }

  return path.resolve(process.cwd(), uploadRoot);
}

function normalizeStoredFilePath(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);

  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.split(path.sep).join('/');
  }

  return filePath;
}

async function removeUploadedFiles(files = []) {
  await Promise.all(files.map(async (file) => {
    try {
      await fsPromises.unlink(file.path);
    } catch (_error) {
      // Best-effort cleanup for incomplete uploads.
    }
  }));
}

function createSellerDocumentsUploadMiddleware({ env }) {
  const uploadDirectory = path.join(resolveUploadDirectory(env.UPLOAD_DIR), 'seller-documents');
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
        callback(error, uploadDirectory);
      });
    },
    filename(req, file, callback) {
      const extension = ALLOWED_FILE_TYPES.get(file.mimetype) || path.extname(file.originalname || '');

      callback(null, `seller-document-${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_DOCUMENT_SIZE_BYTES
    },
    fileFilter(req, file, callback) {
      if (!ALLOWED_FILE_TYPES.has(file.mimetype)) {
        return callback(new AppError('Only pdf, jpg, and png files are allowed for seller documents.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }

      return callback(null, true);
    }
  }).fields([
    { name: 'cacDocument', maxCount: 1 },
    { name: 'proofOfAddressDocument', maxCount: 1 }
  ]);

  return function sellerDocumentsUploadMiddleware(req, res, next) {
    upload(req, res, async (error) => {
      if (error) {
        if (error instanceof AppError) {
          return next(error);
        }

        if (error instanceof multer.MulterError) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Seller documents must be 5MB or smaller.'
            : 'Seller document upload failed.';

          return next(new AppError(message, {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          }));
        }

        return next(error);
      }

      const cacDocument = req.files && req.files.cacDocument ? req.files.cacDocument[0] : null;
      const proofOfAddressDocument = req.files && req.files.proofOfAddressDocument
        ? req.files.proofOfAddressDocument[0]
        : null;

      if (!cacDocument || !proofOfAddressDocument) {
        const uploadedFiles = SELLER_DOCUMENT_FIELD_NAMES
          .flatMap((fieldName) => (req.files && req.files[fieldName]) || []);

        await removeUploadedFiles(uploadedFiles);

        return next(new AppError('Both CAC and proof of address documents are required.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }

      req.uploadedSellerDocuments = {
        cacDocument: {
          filePath: normalizeStoredFilePath(cacDocument.path),
          mimeType: cacDocument.mimetype
        },
        proofOfAddressDocument: {
          filePath: normalizeStoredFilePath(proofOfAddressDocument.path),
          mimeType: proofOfAddressDocument.mimetype
        }
      };

      return next();
    });
  };
}

function createSellerProductImagesUploadMiddleware({ env }) {
  const uploadDirectory = path.join(resolveUploadDirectory(env.UPLOAD_DIR), 'product-images');
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
        callback(error, uploadDirectory);
      });
    },
    filename(req, file, callback) {
      const extension = ALLOWED_PRODUCT_IMAGE_TYPES.get(file.mimetype)
        || path.extname(file.originalname || '');

      callback(null, `product-image-${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES,
      files: MAX_PRODUCT_IMAGE_COUNT
    },
    fileFilter(req, file, callback) {
      if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(file.mimetype)) {
        return callback(new AppError('Only jpg and png files are allowed for product photos.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }

      return callback(null, true);
    }
  }).array('photos', MAX_PRODUCT_IMAGE_COUNT);

  return function sellerProductImagesUploadMiddleware(req, res, next) {
    upload(req, res, (error) => {
      if (error) {
        if (error instanceof AppError) {
          return next(error);
        }

        if (error instanceof multer.MulterError) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Product photos must be 5MB or smaller.'
            : 'Product photo upload failed.';

          return next(new AppError(message, {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          }));
        }

        return next(error);
      }

      req.uploadedProductImages = (req.files || []).map((file, index) => ({
        filePath: normalizeStoredFilePath(file.path),
        mimeType: file.mimetype,
        position: index + 1
      }));

      return next();
    });
  };
}

function createSellerInventoryCsvUploadMiddleware() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_INVENTORY_CSV_SIZE_BYTES,
      files: 1
    },
    fileFilter(req, file, callback) {
      if (!ALLOWED_CSV_TYPES.has(file.mimetype)) {
        return callback(new AppError('Only csv files are allowed for inventory bulk uploads.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }

      return callback(null, true);
    }
  }).single('file');

  return function sellerInventoryCsvUploadMiddleware(req, res, next) {
    upload(req, res, (error) => {
      if (error) {
        if (error instanceof AppError) {
          return next(error);
        }

        if (error instanceof multer.MulterError) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Inventory csv files must be 2MB or smaller.'
            : 'Inventory csv upload failed.';

          return next(new AppError(message, {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          }));
        }

        return next(error);
      }

      if (req.file) {
        req.uploadedInventoryCsv = {
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          originalName: req.file.originalname
        };
      }

      return next();
    });
  };
}

module.exports = {
  createSellerInventoryCsvUploadMiddleware,
  createSellerDocumentsUploadMiddleware,
  createSellerProductImagesUploadMiddleware,
  removeUploadedFiles
};

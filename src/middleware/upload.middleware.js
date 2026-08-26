const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const {
  PRODUCT_IMAGE_TYPES,
  buildBlogImagePath,
  buildProductImageFilename,
  buildProductImagePath,
  createThumbnail,
  getImageType,
  removeStoredProductImages,
  removeStoredBlogImage,
  resolveBlogImageDirectory,
  resolveUploadDirectory,
  resolveUploadRoot,
  stripExif
} = require('../utils/product-image-files');

const ALLOWED_FILE_TYPES = new Map([
  ['application/pdf', '.pdf'],
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
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_COUNT = 6;
const MAX_INVENTORY_CSV_SIZE_BYTES = 2 * 1024 * 1024;

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

function buildProductImageUploadError(error, subject = 'Product photos') {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? `${subject} must be 2MB or smaller.`
      : `${subject} upload failed.`;

    return new AppError(message, {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }

  return error;
}

function mapUploadedProductImages(files = []) {
  return files.map((file, index) => ({
    filePath: buildProductImagePath(file.filename),
    mimeType: file.mimetype,
    position: index + 1
  }));
}

function createSellerDocumentsUploadMiddleware({ env }) {
  const uploadDirectory = path.join(resolveUploadRoot(env.UPLOAD_DIR), 'seller-documents');
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
  const uploadDirectory = resolveUploadDirectory(env.UPLOAD_DIR);
  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, callback) { callback(null, uploadDirectory); },
      filename(_req, file, callback) { callback(null, buildProductImageFilename(file.mimetype)); }
    }),
    limits: { fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES, files: MAX_PRODUCT_IMAGE_COUNT },
    fileFilter(_req, file, callback) {
      if (!PRODUCT_IMAGE_TYPES.has(file.mimetype)) {
        return callback(new AppError('Only jpeg, png, and webp files are allowed for product photos.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }
      return callback(null, true);
    }
  }).array('photos', MAX_PRODUCT_IMAGE_COUNT);

  return function sellerProductImagesUploadMiddleware(req, res, next) {
    upload(req, res, async (error) => {
      if (error) {
        await removeUploadedFiles(req.files || []);
        return next(buildProductImageUploadError(error));
      }

      try {
        for (const file of req.files || []) {
          const actualMimeType = getImageType(await fsPromises.readFile(file.path));
          if (actualMimeType !== file.mimetype) {
            throw new AppError('Product photo contents do not match its declared image type.', {
              statusCode: 422,
              code: ERROR_CODES.VALIDATION_ERROR
            });
          }
          await stripExif(file.path, actualMimeType);
          await createThumbnail(file.path, console);
        }
        req.uploadedProductImages = mapUploadedProductImages(req.files || []);
        req.cleanupUploadedProductImages = () => removeStoredProductImages(env, req.uploadedProductImages);
      } catch (processingError) {
        await removeUploadedFiles(req.files || []);
        await removeStoredProductImages(env, mapUploadedProductImages(req.files || []));
        return next(buildProductImageUploadError(processingError));
      }

      return next();
    });
  };
}

function createAdminBlogImageUploadMiddleware({ env }) {
  const uploadDirectory = resolveBlogImageDirectory(env.UPLOAD_DIR);
  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, callback) { callback(null, uploadDirectory); },
      filename(_req, file, callback) { callback(null, buildProductImageFilename(file.mimetype)); }
    }),
    limits: { fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES, files: 1 },
    fileFilter(_req, file, callback) {
      if (!PRODUCT_IMAGE_TYPES.has(file.mimetype)) {
        return callback(new AppError('Only jpeg, png, and webp files are allowed for blog images.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        }));
      }
      return callback(null, true);
    }
  }).single('featuredImage');

  return function adminBlogImageUploadMiddleware(req, res, next) {
    upload(req, res, async (error) => {
      if (error) return next(buildProductImageUploadError(error, 'Blog images'));
      if (!req.file) return next();
      try {
        const actualMimeType = getImageType(await fsPromises.readFile(req.file.path));
        if (actualMimeType !== req.file.mimetype) {
          throw new AppError('Blog image contents do not match its declared image type.', {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          });
        }
        await stripExif(req.file.path, actualMimeType);
        await createThumbnail(req.file.path, console);
        req.uploadedBlogImage = { filePath: buildBlogImagePath(req.file.filename) };
        req.body.featuredImageUrl = req.uploadedBlogImage.filePath;
        req.cleanupUploadedBlogImage = () => removeStoredBlogImage(env, req.uploadedBlogImage.filePath);
        return next();
      } catch (processingError) {
        await removeUploadedFiles([req.file]);
        return next(buildProductImageUploadError(processingError, 'Blog images'));
      }
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
  createAdminBlogImageUploadMiddleware,
  createSellerInventoryCsvUploadMiddleware,
  createSellerDocumentsUploadMiddleware,
  createSellerProductImagesUploadMiddleware,
  removeUploadedFiles
};

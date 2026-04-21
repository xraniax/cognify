import multer from 'multer';
import path from 'path';
import SettingsService from '../../services/settings.service.js';

import fs from 'fs';

// Use shared upload path in containers; local dev can override via PDF_STORAGE_PATH.
const destPath = process.env.PDF_STORAGE_PATH || '/app/data/uploads';
// Ensure the directory exists (crucial for freshly mounted NFS volumes or fresh clones)
fs.mkdirSync(destPath, { recursive: true });

/**
 * Multer disk storage configuration.
 * Files are saved to the defined destination directory with a timestamped, unique filename.
 */
const storage = multer.diskStorage({
  destination: destPath,
  filename: (req, file, cb) => {
    // Sanitize the original filename to prevent directory traversal
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${file.fieldname}-${Date.now()}-${safeName}`);
  },
});

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

/**
 * File filter: only allow supported document files.
 */
const documentOnlyFilter = (req, file, cb) => {
  const extOk = ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase());

  if (extOk) {
    cb(null, true); // Accept file
  } else {
    // Pass an error with a status code so errorHandler can render it correctly
    const err = new Error(`Only supported document formats are allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}.`);
    err.statusCode = 400;
    cb(err, false); // Reject file
  }
};

/**
 * Middleware for document uploads using dynamic limits from DB.
 */
export const documentUpload = async (req, res, next) => {
  try {
    const controls = await SettingsService.getStorageControls();
    const maxSizeBytes = (controls?.max_file_size_mb || 10) * 1024 * 1024;

    const upload = multer({
      storage,
      fileFilter: documentOnlyFilter,
      limits: { fileSize: maxSizeBytes }
    }).single('file');

    upload(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const customErr = new Error(`File too large. Max allowed size is ${controls.max_file_size_mb}MB.`);
        customErr.statusCode = 400;
        return next(customErr);
      } else if (err) {
        return next(err);
      }
      next();
    });
  } catch (error) {
    next(error);
  }
};

// Keep the raw storage export for any other use-case
export { storage };


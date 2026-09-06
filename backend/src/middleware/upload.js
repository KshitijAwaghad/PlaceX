import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(currentDirectory, '../../uploads/resumes');
fs.mkdirSync(uploadDirectory, { recursive: true });

export const supportedFiles = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']
]);

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMime = supportedFiles.get(extension);
  if (!expectedMime || file.mimetype !== expectedMime) {
    const error = new Error('Unsupported resume format. Upload a PDF, DOCX, JPG, PNG, or WEBP file.');
    error.code = 'INVALID_FILE_TYPE';
    return callback(error);
  }
  return callback(null, true);
};

export const uploadResume = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

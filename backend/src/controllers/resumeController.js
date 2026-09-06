import { extractResumeText } from '../services/resumeParser.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export function uploadResumeFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
          error: { code: 'RESUME_REQUIRED', message: 'Attach a resume using the "resume" field.' }
      });
    }

    return extractResumeText(req.file.path).then((resumeText) => res.status(201).json({
      success: true,
      message: 'Resume parsed and ready for analysis.',
      data: {
        resume: {
          id: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileType: path.extname(req.file.originalname).slice(1).toUpperCase(),
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
          resumeText
        }
      }
    })).catch(next).finally(() => fs.unlink(req.file.path).catch(() => {}));
  } catch (error) {
    return next(error);
  }
}

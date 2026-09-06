import { Router } from 'express';
import { uploadResume } from '../middleware/upload.js';
import { uploadResumeFile } from '../controllers/resumeController.js';

const router = Router();

router.post('/upload', uploadResume.single('resume'), uploadResumeFile);

export default router;

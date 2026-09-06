import { Router } from 'express';
import { analyzeJobDescription } from '../controllers/jobController.js';

const router = Router();

router.post('/analyze', analyzeJobDescription);

export default router;

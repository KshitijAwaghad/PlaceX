import { Router } from 'express';
import { simulateCareer } from '../controllers/careerController.js';

const router = Router();

router.post('/simulate', simulateCareer);

export default router;

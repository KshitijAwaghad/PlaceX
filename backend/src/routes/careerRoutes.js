import { Router } from 'express';
import { simulateCareer } from '../controllers/careerController.js';
import { getHistoryItem, listHistory } from '../controllers/analysisHistoryController.js';

const router = Router();

router.post('/simulate', simulateCareer);
router.get('/history', listHistory);
router.get('/history/:historyId', getHistoryItem);

export default router;

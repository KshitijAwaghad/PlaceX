import { Router } from 'express';
import { createInstantPlan, getInstantPlan } from '../controllers/planController.js';

const router = Router();

router.post('/instant', createInstantPlan);
router.get('/instant', getInstantPlan);

export default router;

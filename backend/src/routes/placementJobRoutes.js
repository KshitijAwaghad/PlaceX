import { Router } from 'express';
import { createPlacementJob, deletePlacementJob, getPlacementJob, listPlacementJobs, updatePlacementJob } from '../controllers/placementJobController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.get('/', listPlacementJobs);
router.get('/:jobId', getPlacementJob);
router.post('/', requireAdmin, createPlacementJob);
router.put('/:jobId', requireAdmin, updatePlacementJob);
router.delete('/:jobId', requireAdmin, deletePlacementJob);

export default router;

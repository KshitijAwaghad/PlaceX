import { Router } from 'express';
import { getProfile, getProfileCompletion, updateProfile } from '../controllers/profileController.js';

const router = Router();
router.get('/', getProfile);
router.put('/', updateProfile);
router.get('/completion', getProfileCompletion);

export default router;

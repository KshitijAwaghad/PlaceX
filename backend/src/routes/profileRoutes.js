import { Router } from 'express';
import { deleteProfilePhoto, getProfile, getProfileCompletion, updateProfile, uploadProfilePhotoFile } from '../controllers/profileController.js';
import { uploadProfilePhoto, validateProfilePhotoContent } from '../middleware/upload.js';

const router = Router();
router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/photo', uploadProfilePhoto.single('photo'), validateProfilePhotoContent, uploadProfilePhotoFile);
router.delete('/photo', deleteProfilePhoto);
router.get('/completion', getProfileCompletion);

export default router;

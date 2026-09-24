import { Router } from 'express';
import { currentUser, googleLogin, googleStatus, login, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/google/status', googleStatus);
router.post('/google', googleLogin);
router.get('/me', requireAuth, currentUser);

export default router;

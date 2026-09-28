import { Router } from 'express';
import { getNotifications, markAllRead, markRead } from '../controllers/notificationController.js';

const router = Router();
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:notificationId/read', markRead);

export default router;

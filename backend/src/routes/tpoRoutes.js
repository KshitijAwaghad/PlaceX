import { Router } from 'express';
import { tpoApplications, tpoDashboard, tpoNotifications, tpoProfile, tpoStudent, tpoStudents } from '../controllers/tpoController.js';

const router = Router();

router.get('/dashboard', tpoDashboard);
router.get('/students', tpoStudents);
router.get('/students/:studentId', tpoStudent);
router.get('/applications', tpoApplications);
router.get('/notifications', tpoNotifications);
router.get('/profile', tpoProfile);

export default router;

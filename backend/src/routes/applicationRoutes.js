import { Router } from 'express';
import { applyToJob, getStudentApplication, listStudentApplications, removeStudentApplication, updateStudentApplication } from '../controllers/applicationController.js';

const router = Router();
router.get('/', listStudentApplications);
router.post('/', applyToJob);
router.get('/:applicationId', getStudentApplication);
router.put('/:applicationId', updateStudentApplication);
router.delete('/:applicationId', removeStudentApplication);

export default router;

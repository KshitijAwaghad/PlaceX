import { createApplication, deleteApplication, findApplication, listApplications, updateApplication } from '../services/applicationService.js';
import { evaluateEligibility } from '../services/eligibilityService.js';
import { findJob, isValidApplicationUrl, jobSourceTypes } from '../services/jobService.js';
import { getStudentProfile } from '../services/profileService.js';

function applicationError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function listStudentApplications(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: { items: await listApplications(req.user.id) } });
  } catch (error) { return next(error); }
}

export async function applyToJob(req, res, next) {
  try {
    const jobId = String(req.body?.jobId || '');
    const job = await findJob(jobId);
    if (!job) throw applicationError('That job was not found.', 404, 'JOB_NOT_FOUND');
    if (job.status !== 'active') throw applicationError('Applications for this job are closed.', 410, 'JOB_EXPIRED');
    if (job.sourceType === jobSourceTypes.OFF_CAMPUS && !isValidApplicationUrl(job.applicationUrl)) throw applicationError('Company application link unavailable for this listing.', 422, 'COMPANY_APPLICATION_LINK_UNAVAILABLE');
    const profile = await getStudentProfile(req.user);
    const eligibility = evaluateEligibility(profile, job);
    if (!eligibility.eligible) throw applicationError(`You are not eligible for this job. ${eligibility.reasons.join(' ')}`, 403, 'NOT_ELIGIBLE');
    const result = await createApplication(req.user.id, jobId);
    return res.status(result.alreadyApplied ? 200 : 201).json({ success: true, data: result });
  } catch (error) { return next(error); }
}

export async function getStudentApplication(req, res, next) {
  try {
    const application = await findApplication(req.user.id, req.params.applicationId);
    if (!application) throw applicationError('That application was not found.', 404, 'APPLICATION_NOT_FOUND');
    return res.status(200).json({ success: true, data: application });
  } catch (error) { return next(error); }
}

export async function updateStudentApplication(req, res, next) {
  try {
    const application = await updateApplication(req.user.id, req.params.applicationId, req.body);
    if (!application) throw applicationError('That application was not found.', 404, 'APPLICATION_NOT_FOUND');
    return res.status(200).json({ success: true, data: application });
  } catch (error) { return next(error); }
}

export async function removeStudentApplication(req, res, next) {
  try {
    if (!await deleteApplication(req.user.id, req.params.applicationId)) throw applicationError('That application was not found.', 404, 'APPLICATION_NOT_FOUND');
    return res.status(204).send();
  } catch (error) { return next(error); }
}

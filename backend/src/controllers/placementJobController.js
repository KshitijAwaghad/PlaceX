import { evaluateEligibility } from '../services/eligibilityService.js';
import { createJob, findJob, listJobs, removeJob, updateJob } from '../services/jobService.js';
import { getStudentProfile } from '../services/profileService.js';

function notFound() {
  const error = new Error('That job was not found.');
  error.statusCode = 404;
  error.code = 'JOB_NOT_FOUND';
  return error;
}

export async function listPlacementJobs(req, res, next) {
  try {
    const [profile, jobs] = await Promise.all([getStudentProfile(req.user), listJobs()]);
    return res.status(200).json({ success: true, data: { items: jobs.map((job) => ({ ...job, eligibility: evaluateEligibility(profile, job) })) } });
  } catch (error) { return next(error); }
}

export async function getPlacementJob(req, res, next) {
  try {
    const [profile, job] = await Promise.all([getStudentProfile(req.user), findJob(req.params.jobId)]);
    if (!job) throw notFound();
    return res.status(200).json({ success: true, data: { ...job, eligibility: evaluateEligibility(profile, job) } });
  } catch (error) { return next(error); }
}

export async function createPlacementJob(req, res, next) {
  try {
    const job = await createJob(req.body, req.user.id);
    return res.status(201).json({ success: true, data: job });
  } catch (error) { return next(error); }
}

export async function updatePlacementJob(req, res, next) {
  try {
    const job = await updateJob(req.params.jobId, req.body);
    if (!job) throw notFound();
    return res.status(200).json({ success: true, data: job });
  } catch (error) { return next(error); }
}

export async function deletePlacementJob(req, res, next) {
  try {
    if (!await removeJob(req.params.jobId)) throw notFound();
    return res.status(204).send();
  } catch (error) { return next(error); }
}

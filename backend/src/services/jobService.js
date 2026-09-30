import { randomUUID } from 'node:crypto';
import { getJobsCollection } from './database.js';
import { uniqueSkills } from './skillNormalization.js';

export const jobSourceTypes = Object.freeze({ ON_CAMPUS: 'ON_CAMPUS', OFF_CAMPUS: 'OFF_CAMPUS' });
export const campusJobStatuses = Object.freeze(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED']);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_JOB';
  return error;
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function nullableText(value, maxLength) {
  return text(value, maxLength) || null;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(value, maxItems = 30, maxLength = 100) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(source.map((item) => text(String(item), maxLength)).filter(Boolean))].slice(0, maxItems);
}

function date(value, label = 'Application deadline', required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) throw validationError(`${label} is required.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw validationError(`${label} must be a valid date.`);
  return parsed.toISOString();
}

function number(value, label, min, max, integer = false, required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) throw validationError(`${label} is required.`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) throw validationError(`${label} is invalid.`);
  return parsed;
}

export function safeApplicationUrl(value) {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function isValidApplicationUrl(value) {
  return safeApplicationUrl(value) !== null;
}

function publicStatus(job) {
  if (job.jobStatus && job.jobStatus !== 'PUBLISHED') return 'expired';
  if (job.status === 'expired') return 'expired';
  const deadline = job.deadline ? new Date(job.deadline).getTime() : null;
  return deadline !== null && !Number.isNaN(deadline) && deadline < Date.now() ? 'expired' : 'active';
}

export function publicJob(job) {
  if (!job) return null;
  const { _id, createdBy, ...details } = job;
  return {
    ...details,
    id: String(_id),
    sourceType: details.sourceType || jobSourceTypes.ON_CAMPUS,
    jobStatus: details.jobStatus || 'PUBLISHED',
    companyName: nullableText(details.companyName, 120),
    role: nullableText(details.role, 120),
    jobDescription: nullableText(details.jobDescription, 12_000),
    ctc: nullableText(details.ctc, 80),
    ctcLpa: finiteNumberOrNull(details.ctcLpa),
    salaryMin: finiteNumberOrNull(details.salaryMin),
    salaryMax: finiteNumberOrNull(details.salaryMax),
    location: nullableText(details.location, 120),
    deadline: details.deadline || null,
    postedAt: details.postedAt || null,
    applicationUrl: safeApplicationUrl(details.applicationUrl),
    requiredSkills: uniqueSkills(details.requiredSkills),
    eligibleBranches: list(details.eligibleBranches),
    graduationYears: list(details.graduationYears, 10, 4).map(Number).filter(Number.isInteger),
    minimumCgpa: finiteNumberOrNull(details.minimumCgpa),
    maximumBacklogs: finiteNumberOrNull(details.maximumBacklogs),
    employmentType: nullableText(details.employmentType, 80),
    status: publicStatus(job)
  };
}

export function normalizeOnCampusJob(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError('Job data must be an object.');
  const result = {};
  const fields = [
    ['companyName', 120], ['role', 120], ['jobDescription', 12_000], ['ctc', 80], ['location', 120], ['additionalCriteria', 1_000], ['employmentType', 80]
  ];
  for (const [field, maxLength] of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = text(input[field], maxLength);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'deadline')) result.deadline = date(input.deadline, 'Application deadline', !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'ctcLpa')) result.ctcLpa = number(input.ctcLpa, 'CTC', 0, 200);
  if (Object.prototype.hasOwnProperty.call(input, 'minimumCgpa')) result.minimumCgpa = number(input.minimumCgpa, 'Minimum CGPA', 0, 10, false, !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'maximumBacklogs')) result.maximumBacklogs = number(input.maximumBacklogs, 'Maximum backlogs', 0, 50, true, !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'eligibleBranches')) result.eligibleBranches = list(input.eligibleBranches);
  if (Object.prototype.hasOwnProperty.call(input, 'graduationYears')) result.graduationYears = list(input.graduationYears, 10, 4).map(Number).filter(Number.isInteger);
  if (Object.prototype.hasOwnProperty.call(input, 'requiredSkills')) result.requiredSkills = uniqueSkills(input.requiredSkills).slice(0, 50);

  if (!partial) {
    for (const field of ['companyName', 'role', 'jobDescription', 'ctc', 'location', 'deadline']) {
      if (!result[field]) throw validationError(`${field} is required.`);
    }
    for (const field of ['minimumCgpa', 'maximumBacklogs', 'ctcLpa']) {
      if (result[field] === null || result[field] === undefined) throw validationError(`${field} is required.`);
    }
    if (!Array.isArray(result.eligibleBranches) || !result.eligibleBranches.length) throw validationError('At least one eligible branch is required.');
    if (!Array.isArray(result.graduationYears) || !result.graduationYears.length) throw validationError('At least one eligible graduation year is required.');
    if (!Array.isArray(result.requiredSkills)) result.requiredSkills = [];
  }
  return result;
}

export async function purgeLegacyGeneratedJobs() {
  const jobs = await getJobsCollection();
  // Previous releases marked generated sample rows with this exact shape. Real
  // TPO and provider rows always have an explicit sourceType.
  await jobs.deleteMany({ createdBy: 'system', sourceType: { $exists: false } });
  await jobs.updateMany(
    { sourceType: { $exists: false }, createdBy: { $ne: 'system' } },
    { $set: { sourceType: jobSourceTypes.ON_CAMPUS, jobStatus: 'PUBLISHED', updatedAt: new Date().toISOString() } }
  );
}

export async function listOnCampusJobs() {
  await purgeLegacyGeneratedJobs();
  const jobs = await (await getJobsCollection()).find({ sourceType: jobSourceTypes.ON_CAMPUS, jobStatus: 'PUBLISHED' }).sort({ deadline: 1 }).toArray();
  return jobs.map(publicJob).filter((job) => job.status === 'active');
}

export async function listCampusJobsForManagement() {
  await purgeLegacyGeneratedJobs();
  const jobs = await (await getJobsCollection()).find({ sourceType: jobSourceTypes.ON_CAMPUS }).sort({ updatedAt: -1 }).toArray();
  return jobs.map(publicJob);
}

export async function findJob(jobId) {
  await purgeLegacyGeneratedJobs();
  return publicJob(await (await getJobsCollection()).findOne({ _id: jobId }));
}

export async function createCampusJob(input, managerId) {
  const job = normalizeOnCampusJob(input);
  const now = new Date().toISOString();
  const record = {
    _id: randomUUID(),
    ...job,
    sourceType: jobSourceTypes.ON_CAMPUS,
    jobStatus: 'DRAFT',
    applicationUrl: null,
    createdBy: managerId,
    createdAt: now,
    updatedAt: now
  };
  await (await getJobsCollection()).insertOne(record);
  return publicJob(record);
}

export async function updateCampusJob(jobId, input) {
  const changes = normalizeOnCampusJob(input, true);
  const result = await (await getJobsCollection()).findOneAndUpdate(
    { _id: jobId, sourceType: jobSourceTypes.ON_CAMPUS, jobStatus: { $ne: 'ARCHIVED' } },
    { $set: { ...changes, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return publicJob(result);
}

export async function setCampusJobStatus(jobId, jobStatus) {
  if (!campusJobStatuses.includes(jobStatus)) throw validationError('Campus job status is invalid.');
  const result = await (await getJobsCollection()).findOneAndUpdate(
    { _id: jobId, sourceType: jobSourceTypes.ON_CAMPUS },
    { $set: { jobStatus, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return publicJob(result);
}

export async function archiveCampusJob(jobId) {
  return setCampusJobStatus(jobId, 'ARCHIVED');
}

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { getApplicationsCollection } from './database.js';
import { findJob, jobSourceTypes, safeApplicationUrl } from './jobService.js';

const require = createRequire(import.meta.url);
export const applicationStatuses = require('../../../shared/applicationStatuses.json');

function applicationError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanNotes(value) {
  return String(value || '').trim().slice(0, 1_000);
}

function applicationChannel(record, job) {
  return record.hiringType || job?.sourceType || jobSourceTypes.ON_CAMPUS;
}

function publicApplication(record, job) {
  const { _id, userId, ...details } = record;
  const hiringType = applicationChannel(record, job);
  return {
    ...details,
    id: String(_id),
    hiringType,
    externalApplicationUrl: hiringType === jobSourceTypes.OFF_CAMPUS ? safeApplicationUrl(record.externalApplicationUrl || job?.applicationUrl) : null,
    source: record.source || job?.source || null,
    job: job || null
  };
}

function trackingRecord(userId, jobId, job) {
  const now = new Date().toISOString();
  const hiringType = job?.sourceType || jobSourceTypes.ON_CAMPUS;
  return {
    _id: randomUUID(),
    userId,
    jobId,
    hiringType,
    source: job?.source || null,
    externalApplicationUrl: hiringType === jobSourceTypes.OFF_CAMPUS ? safeApplicationUrl(job?.applicationUrl) : null,
    appliedAt: now,
    status: 'Applied',
    notes: '',
    updatedAt: now
  };
}

export async function findOrCreateApplication(applications, userId, jobId, jobLookup = findJob) {
  const job = await jobLookup(jobId);
  const existing = await applications.findOne({ userId, jobId });
  if (existing) return { application: publicApplication(existing, job), alreadyApplied: true };

  const record = trackingRecord(userId, jobId, job);
  try {
    await applications.insertOne(record);
    return { application: publicApplication(record, job), alreadyApplied: false };
  } catch (error) {
    if (error?.code === 11000) {
      const concurrentApplication = await applications.findOne({ userId, jobId });
      if (concurrentApplication) return { application: publicApplication(concurrentApplication, job), alreadyApplied: true };
    }
    throw error;
  }
}

export async function createApplication(userId, jobId) {
  return findOrCreateApplication(await getApplicationsCollection(), userId, jobId);
}

export async function listApplications(userId) {
  const records = await (await getApplicationsCollection()).find({ userId }).sort({ updatedAt: -1 }).toArray();
  const jobs = await Promise.all(records.map((record) => findJob(record.jobId)));
  return records.map((record, index) => publicApplication(record, jobs[index]));
}

export async function listApplicationsForCampusJob(jobId) {
  const records = await (await getApplicationsCollection()).find({ jobId, hiringType: jobSourceTypes.ON_CAMPUS }).sort({ updatedAt: -1 }).toArray();
  const job = await findJob(jobId);
  return records.map((record) => ({ ...publicApplication(record, job), studentId: record.userId }));
}

export async function findApplication(userId, applicationId) {
  const record = await (await getApplicationsCollection()).findOne({ _id: applicationId, userId });
  return record ? publicApplication(record, await findJob(record.jobId)) : null;
}

export async function updateApplication(userId, applicationId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw applicationError('Application updates must be an object.', 400, 'INVALID_APPLICATION');
  const changes = { updatedAt: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input, 'notes')) changes.notes = cleanNotes(input.notes);
  const result = await (await getApplicationsCollection()).findOneAndUpdate({ _id: applicationId, userId }, { $set: changes }, { returnDocument: 'after' });
  return result ? publicApplication(result, await findJob(result.jobId)) : null;
}

export async function updateCampusApplicationStatus(applicationId, status) {
  if (!applicationStatuses.includes(status)) throw applicationError('Application status is invalid.', 400, 'INVALID_APPLICATION_STATUS');
  const result = await (await getApplicationsCollection()).findOneAndUpdate(
    { _id: applicationId, hiringType: jobSourceTypes.ON_CAMPUS },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return result ? publicApplication(result, await findJob(result.jobId)) : null;
}

export async function deleteApplication(userId, applicationId) {
  const result = await (await getApplicationsCollection()).deleteOne({ _id: applicationId, userId });
  return result.deletedCount === 1;
}

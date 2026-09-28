import { randomUUID } from 'node:crypto';
import { getApplicationsCollection } from './database.js';
import { findJob } from './jobService.js';

export const applicationStatuses = ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'];

function applicationError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanNotes(value) {
  return String(value || '').trim().slice(0, 1_000);
}

function publicApplication(record, job) {
  const { _id, userId, ...details } = record;
  return { ...details, id: String(_id), job: job || null };
}

export async function createApplication(userId, jobId) {
  const now = new Date().toISOString();
  const record = { _id: randomUUID(), userId, jobId, appliedAt: now, status: 'Applied', notes: '', updatedAt: now };
  try {
    await (await getApplicationsCollection()).insertOne(record);
    return publicApplication(record, await findJob(jobId));
  } catch (error) {
    if (error?.code === 11000) throw applicationError('You have already applied to this job.', 409, 'DUPLICATE_APPLICATION');
    throw error;
  }
}

export async function listApplications(userId) {
  const records = await (await getApplicationsCollection()).find({ userId }).sort({ updatedAt: -1 }).toArray();
  const jobs = await Promise.all(records.map((record) => findJob(record.jobId)));
  return records.map((record, index) => publicApplication(record, jobs[index]));
}

export async function findApplication(userId, applicationId) {
  const record = await (await getApplicationsCollection()).findOne({ _id: applicationId, userId });
  return record ? publicApplication(record, await findJob(record.jobId)) : null;
}

export async function updateApplication(userId, applicationId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw applicationError('Application updates must be an object.', 400, 'INVALID_APPLICATION');
  const changes = { updatedAt: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    if (!applicationStatuses.includes(input.status)) throw applicationError('Application status is invalid.', 400, 'INVALID_APPLICATION_STATUS');
    changes.status = input.status;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'notes')) changes.notes = cleanNotes(input.notes);
  const applications = await getApplicationsCollection();
  const result = await applications.findOneAndUpdate({ _id: applicationId, userId }, { $set: changes }, { returnDocument: 'after' });
  return result ? publicApplication(result, await findJob(result.jobId)) : null;
}

export async function deleteApplication(userId, applicationId) {
  const result = await (await getApplicationsCollection()).deleteOne({ _id: applicationId, userId });
  return result.deletedCount === 1;
}

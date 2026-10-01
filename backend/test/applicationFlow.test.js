import assert from 'node:assert/strict';
import test from 'node:test';
import { findOrCreateApplication } from '../src/services/applicationService.js';
import { isValidApplicationUrl, jobSourceTypes, normalizeOnCampusJob, publicJob, safeApplicationUrl } from '../src/services/jobService.js';
import { normalizeExternalJob } from '../src/services/offCampusJobService.js';

const job = { id: 'job-1', sourceType: jobSourceTypes.OFF_CAMPUS, applicationUrl: 'https://careers.example.com/jobs/1' };
const jobLookup = async () => job;

function memoryApplications(records = []) {
  let insertCount = 0;
  return {
    get insertCount() { return insertCount; },
    async findOne(query) { return records.find((record) => record.userId === query.userId && record.jobId === query.jobId) || null; },
    async insertOne(record) { insertCount += 1; records.push(record); }
  };
}

test('accepts only http(s) application links and never serializes unsafe links', () => {
  assert.equal(isValidApplicationUrl('https://careers.example.com/job/42'), true);
  assert.equal(isValidApplicationUrl('http://careers.example.com/job/42'), true);
  assert.equal(isValidApplicationUrl('javascript:alert(1)'), false);
  assert.equal(isValidApplicationUrl('data:text/html,unsafe'), false);
  assert.equal(safeApplicationUrl('not a URL'), null);
  assert.equal(publicJob({ _id: 'job-1', deadline: '2099-01-01T00:00:00.000Z', applicationUrl: 'https://careers.example.com/job/42' }).applicationUrl, 'https://careers.example.com/job/42');
  assert.equal(publicJob({ _id: 'job-1', deadline: '2099-01-01T00:00:00.000Z', applicationUrl: 'javascript:alert(1)' }).applicationUrl, null);
});

test('creates one tracker record for a new company application', async () => {
  const applications = memoryApplications();
  const result = await findOrCreateApplication(applications, 'student-1', 'job-1', jobLookup);

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.application.jobId, 'job-1');
  assert.equal(result.application.status, 'Applied');
  assert.equal(result.application.hiringType, jobSourceTypes.OFF_CAMPUS);
  assert.equal(applications.insertCount, 1);
});

test('returns an existing tracker record without creating a duplicate', async () => {
  const applications = memoryApplications([{ _id: 'application-1', userId: 'student-1', jobId: 'job-1', appliedAt: '2026-01-01T00:00:00.000Z', status: 'Applied', notes: '', updatedAt: '2026-01-01T00:00:00.000Z' }]);
  const result = await findOrCreateApplication(applications, 'student-1', 'job-1', jobLookup);

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.application.id, 'application-1');
  assert.equal(applications.insertCount, 0);
});

test('treats a concurrent duplicate-key insert as an existing tracker record', async () => {
  const concurrent = { _id: 'application-race', userId: 'student-1', jobId: 'job-1', appliedAt: '2026-01-01T00:00:00.000Z', status: 'Applied', notes: '', updatedAt: '2026-01-01T00:00:00.000Z' };
  let reads = 0;
  const applications = {
    async findOne() { reads += 1; return reads === 1 ? null : concurrent; },
    async insertOne() { throw { code: 11000 }; }
  };
  const result = await findOrCreateApplication(applications, 'student-1', 'job-1', jobLookup);

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.application.id, 'application-race');
});

test('normalizes a campus job from TPO input without assigning an external URL', () => {
  const job = normalizeOnCampusJob({
    companyName: 'Organization', role: 'Role', jobDescription: 'Description', ctc: 'Compensation', ctcLpa: 4,
    location: 'Location', deadline: '2099-01-01', requiredSkills: ['ReactJS'], eligibleBranches: ['Computing'],
    minimumCgpa: 6, maximumBacklogs: 0, graduationYears: [2099], employmentType: 'Full time'
  });
  assert.deepEqual(job.requiredSkills, ['React']);
  assert.equal(job.applicationUrl, undefined);
});

test('allows incomplete drive data to be saved as a draft while retaining the canonical description field', () => {
  const draft = normalizeOnCampusJob({ companyName: 'Organization', jobDescription: 'Draft description' }, true);

  assert.equal(draft.companyName, 'Organization');
  assert.equal(draft.jobDescription, 'Draft description');
  assert.equal(draft.role, undefined);
});

test('normalizes provider data with catalog-only inferred skills and no fabricated requirements', () => {
  const job = normalizeExternalJob('provider', {
    externalId: 'external-1', companyName: null, role: null, location: null, applicationUrl: 'https://careers.example.com/job',
    jobDescription: 'Build interfaces with React and services with Node.js. Familiarity with Java is useful.', rawSkills: []
  }, '2099-01-01T00:00:00.000Z');
  assert.deepEqual(job.requiredSkills, ['Java', 'React', 'Node.js']);
  assert.equal(job.minimumCgpa, null);
  assert.equal(job.maximumBacklogs, null);
  assert.equal(job.requirementsSource, 'INFERRED_FROM_DESCRIPTION');
});

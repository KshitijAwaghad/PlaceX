import { randomUUID } from 'node:crypto';
import { getJobsCollection } from './database.js';

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_JOB';
  return error;
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function list(value, maxItems = 30, maxLength = 100) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(source.map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function date(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw validationError('Application deadline must be a valid date.');
  return parsed.toISOString();
}

function number(value, label, min, max, integer = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) throw validationError(`${label} is invalid.`);
  return parsed;
}

function statusFor(job) {
  return job.status === 'expired' || new Date(job.deadline).getTime() < Date.now() ? 'expired' : 'active';
}

function publicJob(job) {
  if (!job) return null;
  const { _id, createdBy, ...details } = job;
  return { ...details, id: String(_id), status: statusFor(job) };
}

function normalizedJob(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError('Job data must be an object.');
  const result = {};
  const fields = [
    ['companyName', 120], ['role', 120], ['jobDescription', 12_000], ['ctc', 80], ['location', 120], ['additionalCriteria', 1_000]
  ];
  for (const [field, maxLength] of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = text(input[field], maxLength);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'deadline')) result.deadline = date(input.deadline);
  if (Object.prototype.hasOwnProperty.call(input, 'ctcLpa')) result.ctcLpa = number(input.ctcLpa, 'CTC', 0, 200);
  if (Object.prototype.hasOwnProperty.call(input, 'minimumCgpa')) result.minimumCgpa = number(input.minimumCgpa, 'Minimum CGPA', 0, 10);
  if (Object.prototype.hasOwnProperty.call(input, 'maximumBacklogs')) result.maximumBacklogs = number(input.maximumBacklogs, 'Maximum backlogs', 0, 50, true);
  if (Object.prototype.hasOwnProperty.call(input, 'eligibleBranches')) result.eligibleBranches = list(input.eligibleBranches);
  if (Object.prototype.hasOwnProperty.call(input, 'graduationYears')) result.graduationYears = list(input.graduationYears, 10, 4).map(Number).filter(Number.isInteger);
  if (Object.prototype.hasOwnProperty.call(input, 'requiredSkills')) result.requiredSkills = list(input.requiredSkills, 50);
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    if (!['active', 'expired'].includes(input.status)) throw validationError('Job status must be active or expired.');
    result.status = input.status;
  }
  if (!partial) {
    for (const field of ['companyName', 'role', 'jobDescription', 'ctc', 'location', 'deadline']) {
      if (!result[field]) throw validationError(`${field} is required.`);
    }
    if (!Object.prototype.hasOwnProperty.call(result, 'minimumCgpa')) result.minimumCgpa = 0;
    if (!Object.prototype.hasOwnProperty.call(result, 'maximumBacklogs')) result.maximumBacklogs = 0;
    if (!Object.prototype.hasOwnProperty.call(result, 'ctcLpa')) result.ctcLpa = 0;
    if (!Object.prototype.hasOwnProperty.call(result, 'eligibleBranches')) result.eligibleBranches = [];
    if (!Object.prototype.hasOwnProperty.call(result, 'graduationYears')) result.graduationYears = [];
    if (!Object.prototype.hasOwnProperty.call(result, 'requiredSkills')) result.requiredSkills = [];
    if (!Object.prototype.hasOwnProperty.call(result, 'status')) result.status = 'active';
  }
  return result;
}

function futureDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const sampleJobs = () => [
  { companyName: 'Infosys', role: 'System Engineer', jobDescription: 'Build and maintain reliable software services with Java, SQL and REST APIs.', ctc: '₹3.6 LPA', ctcLpa: 3.6, location: 'Pune', deadline: futureDate(7), minimumCgpa: 6, maximumBacklogs: 0, eligibleBranches: ['Computer Engineering', 'Information Technology', 'Electronics and Computer Engineering'], graduationYears: [2027], requiredSkills: ['Java', 'SQL', 'REST APIs'], additionalCriteria: 'Strong communication and problem-solving skills.', status: 'active' },
  { companyName: 'Accenture', role: 'Associate Software Engineer', jobDescription: 'Deliver full-stack solutions using JavaScript, Node.js and cloud fundamentals.', ctc: '₹4.5 LPA', ctcLpa: 4.5, location: 'Mumbai', deadline: futureDate(3), minimumCgpa: 6.5, maximumBacklogs: 1, eligibleBranches: ['Computer Engineering', 'Information Technology', 'Electronics and Computer Engineering'], graduationYears: [2027], requiredSkills: ['JavaScript', 'Node.js', 'Git'], additionalCriteria: 'Open to rotational shifts.', status: 'active' },
  { companyName: 'TCS', role: 'Digital Developer', jobDescription: 'Develop scalable web applications and data integrations for enterprise clients.', ctc: '₹7 LPA', ctcLpa: 7, location: 'Pune', deadline: futureDate(10), minimumCgpa: 7, maximumBacklogs: 0, eligibleBranches: ['Computer Engineering', 'Information Technology'], graduationYears: [2027], requiredSkills: ['React', 'Node.js', 'SQL'], additionalCriteria: 'Minimum 60% throughout academics.', status: 'active' },
  { companyName: 'Capgemini', role: 'Data Analyst', jobDescription: 'Analyze business data, build reports and communicate data-led insights.', ctc: '₹5.2 LPA', ctcLpa: 5.2, location: 'Bengaluru', deadline: futureDate(14), minimumCgpa: 6.5, maximumBacklogs: 0, eligibleBranches: ['Computer Engineering', 'Information Technology', 'Electronics and Computer Engineering'], graduationYears: [2027], requiredSkills: ['SQL', 'Excel', 'Power BI'], additionalCriteria: 'Portfolio project preferred.', status: 'active' }
];

export async function ensureSampleJobs() {
  const jobs = await getJobsCollection();
  if (await jobs.countDocuments({}, { limit: 1 })) return;
  const now = new Date().toISOString();
  await jobs.insertMany(sampleJobs().map((job) => ({ _id: randomUUID(), ...job, createdBy: 'system', createdAt: now, updatedAt: now })));
}

export async function listJobs() {
  await ensureSampleJobs();
  const jobs = await (await getJobsCollection()).find({}).sort({ deadline: 1 }).toArray();
  return jobs.map(publicJob);
}

export async function findJob(jobId) {
  await ensureSampleJobs();
  return publicJob(await (await getJobsCollection()).findOne({ _id: jobId }));
}

export async function createJob(input, adminId) {
  const job = normalizedJob(input);
  const now = new Date().toISOString();
  const record = { _id: randomUUID(), ...job, createdBy: adminId, createdAt: now, updatedAt: now };
  await (await getJobsCollection()).insertOne(record);
  return publicJob(record);
}

export async function updateJob(jobId, input) {
  const changes = normalizedJob(input, true);
  const jobs = await getJobsCollection();
  const result = await jobs.findOneAndUpdate({ _id: jobId }, { $set: { ...changes, updatedAt: new Date().toISOString() } }, { returnDocument: 'after' });
  return publicJob(result);
}

export async function removeJob(jobId) {
  const result = await (await getJobsCollection()).deleteOne({ _id: jobId });
  return result.deletedCount === 1;
}

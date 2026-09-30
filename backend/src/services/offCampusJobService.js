import { createHash } from 'node:crypto';
import { getJobsCollection } from './database.js';
import { jobSourceTypes, publicJob, safeApplicationUrl } from './jobService.js';
import { getJobProvider } from './jobProviders/index.js';
import { catalogSkills, uniqueSkills } from './skillNormalization.js';

const cacheDurationMs = Math.max(Number(process.env.OFF_CAMPUS_CACHE_MINUTES) || 30, 1) * 60 * 1000;

function nullableText(value, maxLength) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function extractCatalogSkills(description) {
  const normalizeTokens = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();
  const source = ` ${normalizeTokens(description)} `;
  if (!source) return [];
  return catalogSkills()
    .filter((skill) => source.includes(` ${normalizeTokens(skill)} `));
}

function externalFingerprint(source, job) {
  const stable = [source, job.companyName || '', job.role || '', job.location || '', job.applicationUrl || ''].join('|').toLowerCase();
  return createHash('sha256').update(stable).digest('hex');
}

export function normalizeExternalJob(source, providerJob, now = new Date().toISOString()) {
  const description = nullableText(providerJob.jobDescription, 12_000);
  const suppliedSkills = uniqueSkills(providerJob.rawSkills).filter((skill) => catalogSkills().includes(skill));
  const requiredSkills = suppliedSkills.length ? suppliedSkills : extractCatalogSkills(description);
  const applicationUrl = safeApplicationUrl(providerJob.applicationUrl);
  const companyName = nullableText(providerJob.companyName, 120);
  const role = nullableText(providerJob.role, 120);
  const location = nullableText(providerJob.location, 120);
  const externalId = nullableText(providerJob.externalId, 200) || externalFingerprint(source, { companyName, role, location, applicationUrl });
  return {
    _id: `${source}:${externalId}`,
    sourceType: jobSourceTypes.OFF_CAMPUS,
    source,
    externalId,
    companyName,
    role,
    jobDescription: description,
    ctc: null,
    ctcLpa: null,
    salaryMin: numberOrNull(providerJob.salaryMin),
    salaryMax: numberOrNull(providerJob.salaryMax),
    location,
    applicationUrl,
    deadline: dateOrNull(providerJob.deadline),
    postedAt: dateOrNull(providerJob.postedAt),
    employmentType: nullableText(providerJob.employmentType, 80),
    requiredSkills,
    requirementsSource: suppliedSkills.length ? 'PROVIDER' : requiredSkills.length ? 'INFERRED_FROM_DESCRIPTION' : 'NOT_PROVIDED',
    eligibleBranches: [],
    minimumCgpa: null,
    maximumBacklogs: null,
    graduationYears: [],
    jobStatus: 'PUBLISHED',
    lastSyncedAt: now,
    updatedAt: now
  };
}

async function cachedJobs(source) {
  const records = await (await getJobsCollection()).find({ sourceType: jobSourceTypes.OFF_CAMPUS, source }).sort({ postedAt: -1, lastSyncedAt: -1 }).toArray();
  return records;
}

function isFresh(records) {
  const latest = records.reduce((value, record) => Math.max(value, new Date(record.lastSyncedAt || 0).getTime() || 0), 0);
  return latest > 0 && Date.now() - latest < cacheDurationMs;
}

async function refreshProviderCache(provider, query) {
  const rawJobs = await provider.searchJobs(query);
  const now = new Date().toISOString();
  const records = new Map();
  for (const rawJob of rawJobs) {
    const job = normalizeExternalJob(provider.name, provider.normalizeJob(rawJob), now);
    records.set(`${job.source}:${job.externalId}`, job);
  }
  const jobs = await getJobsCollection();
  await Promise.all([...records.values()].map((job) => jobs.updateOne(
    { sourceType: jobSourceTypes.OFF_CAMPUS, source: job.source, externalId: job.externalId },
    { $set: job, $setOnInsert: { createdAt: now } },
    { upsert: true }
  )));
  return cachedJobs(provider.name);
}

export async function listOffCampusJobs(query = {}) {
  let provider;
  try {
    provider = getJobProvider();
  } catch (error) {
    return { items: [], availability: 'not_configured', message: error.message, updatedAt: null };
  }
  const cache = await cachedJobs(provider.name);
  if (isFresh(cache)) return { items: cache.map(publicJob).filter((job) => job.status === 'active'), availability: 'cached', message: null, updatedAt: cache[0]?.lastSyncedAt || null };
  try {
    const refreshed = await refreshProviderCache(provider, query);
    return { items: refreshed.map(publicJob).filter((job) => job.status === 'active'), availability: 'refreshed', message: null, updatedAt: refreshed[0]?.lastSyncedAt || null };
  } catch (error) {
    if (cache.length) return { items: cache.map(publicJob).filter((job) => job.status === 'active'), availability: 'cached', message: 'Showing cached off-campus jobs while the provider is unavailable.', updatedAt: cache[0]?.lastSyncedAt || null };
    return { items: [], availability: error.code === 'OFF_CAMPUS_PROVIDER_NOT_CONFIGURED' ? 'not_configured' : 'unavailable', message: error.message || 'Off-campus jobs are temporarily unavailable.', updatedAt: null };
  }
}

import { createAdzunaProvider } from './adzunaProvider.js';

export function getJobProvider(environment = process.env, fetchImplementation = globalThis.fetch) {
  const provider = String(environment.JOB_API_PROVIDER || 'adzuna').trim().toLowerCase();
  if (provider === 'adzuna') return createAdzunaProvider(environment, fetchImplementation);

  const error = new Error(`Unsupported off-campus job provider: ${provider || 'not configured'}.`);
  error.code = 'OFF_CAMPUS_PROVIDER_UNSUPPORTED';
  error.statusCode = 503;
  throw error;
}

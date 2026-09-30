import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdzunaProvider } from '../src/services/jobProviders/adzunaProvider.js';

test('uses the Adzuna API default URL when no base URL is configured', async () => {
  let requestedUrl;
  const provider = createAdzunaProvider(
    { ADZUNA_APP_ID: 'app-id', ADZUNA_APP_KEY: 'app-key', JOB_API_COUNTRY: 'in' },
    async (url) => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ results: [] }) };
    }
  );

  await provider.searchJobs({ what: 'software engineer', limit: 5 });

  assert.equal(requestedUrl.origin, 'https://api.adzuna.com');
  assert.equal(requestedUrl.pathname, '/v1/api/jobs/in/search/1');
  assert.equal(requestedUrl.searchParams.get('app_id'), 'app-id');
  assert.equal(requestedUrl.searchParams.get('app_key'), 'app-key');
  assert.equal(requestedUrl.searchParams.get('what'), 'software engineer');
  assert.equal(requestedUrl.searchParams.get('results_per_page'), '5');
});

test('requires an Adzuna app key', async () => {
  const provider = createAdzunaProvider({ ADZUNA_APP_ID: 'app-id' });

  await assert.rejects(
    () => provider.searchJobs(),
    (error) => error.code === 'OFF_CAMPUS_PROVIDER_NOT_CONFIGURED'
  );
});

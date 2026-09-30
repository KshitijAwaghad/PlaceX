function providerError(message, code = 'OFF_CAMPUS_PROVIDER_UNAVAILABLE', statusCode = 503) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function configured(value) {
  return String(value || '').trim();
}

function requestUrl(baseUrl, country, appId, appKey, query = {}) {
  const base = configured(baseUrl).replace(/\/+$/, '');
  if (!base || !appId || !appKey) throw providerError('Off-campus job search is not configured. Add the job provider credentials to backend/.env.', 'OFF_CAMPUS_PROVIDER_NOT_CONFIGURED');
  const url = new URL(`${base}/jobs/${encodeURIComponent(country)}/search/1`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('content-type', 'application/json');
  url.searchParams.set('results_per_page', String(Math.min(Math.max(Number(query.limit) || 30, 1), 50)));
  url.searchParams.set('sort_by', 'date');
  if (configured(query.what)) url.searchParams.set('what', configured(query.what));
  if (configured(query.where)) url.searchParams.set('where', configured(query.where));
  return url;
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeResult(result) {
  return {
    externalId: nullableText(result?.id),
    companyName: nullableText(result?.company?.display_name),
    role: nullableText(result?.title),
    jobDescription: nullableText(result?.description),
    location: nullableText(result?.location?.display_name),
    applicationUrl: nullableText(result?.redirect_url),
    postedAt: nullableText(result?.created),
    deadline: nullableText(result?.expires),
    employmentType: nullableText(result?.contract_type),
    salaryMin: result?.salary_min,
    salaryMax: result?.salary_max,
    rawSkills: Array.isArray(result?.skills) ? result.skills : []
  };
}

export function createAdzunaProvider(environment = process.env, fetchImplementation = globalThis.fetch) {
  const appId = configured(environment.ADZUNA_APP_ID);
  const appKey = configured(environment.ADZUNA_APP_KEY || environment.JOB_API_KEY);
  // Keep the provider usable for existing installations created before this
  // setting was added to .env. Credentials are still always required.
  const baseUrl = configured(environment.JOB_API_BASE_URL) || 'https://api.adzuna.com/v1/api';
  const country = configured(environment.JOB_API_COUNTRY) || 'in';

  return {
    name: 'adzuna',
    async searchJobs(query = {}) {
      const url = requestUrl(baseUrl, country, appId, appKey, query);
      let response;
      try {
        response = await fetchImplementation(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      } catch {
        throw providerError('Off-campus jobs are temporarily unavailable.');
      }
      if (!response.ok) throw providerError('Off-campus jobs are temporarily unavailable.');
      const payload = await response.json().catch(() => null);
      if (!Array.isArray(payload?.results)) throw providerError('The off-campus job provider returned an invalid response.');
      return payload.results;
    },
    getJob() {
      throw providerError('The selected off-campus provider does not expose individual job retrieval in this integration.', 'OFF_CAMPUS_JOB_LOOKUP_UNSUPPORTED', 501);
    },
    normalizeJob: normalizeResult
  };
}

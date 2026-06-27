import type { SearchQuery } from '../llm/profile-builder.js';
import { logger } from '../logger.js';

export interface Job {
  id?: string;
  title: string;
  companyName?: string;
  jobUrl?: string;
  location?: { city?: string; country?: string };
  compensation?: { minAmount?: number; maxAmount?: number; currency?: string; interval?: string };
  datePosted?: string;
  isRemote?: boolean;
  site?: string;
  description?: string;
}

interface EverJobsResponse {
  jobs: Job[];
  count: number;
}

export async function searchJobs(apiUrl: string, queries: SearchQuery[]): Promise<Job[]> {
  const results = await Promise.allSettled(
    queries.map((q) => fetchJobs(apiUrl, q)),
  );

  const all: Job[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    } else {
      logger.warn(`Query falló: ${String(r.reason)}`);
    }
  }

  return deduplicateJobs(all);
}

async function fetchJobs(apiUrl: string, query: SearchQuery): Promise<Job[]> {
  const body = {
    searchTerm: query.searchTerm,
    location: query.location,
    isRemote: query.isRemote,
    country: query.country,
    resultsWanted: query.resultsWanted,
    hoursOld: query.hoursOld,
    siteType: query.siteType,
    linkedinFetchDescription: false,
  };

  logger.info(`Buscando: "${query.searchTerm}" en ${query.location ?? 'global'}`);

  const res = await fetch(`${apiUrl}/api/jobs/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`ever-jobs respondió ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as EverJobsResponse;
  logger.info(`  → ${data.jobs.length} empleos encontrados`);
  return data.jobs;
}

function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const key = j.id ?? j.jobUrl ?? `${j.title}|${j.companyName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

import type { SearchQuery } from '../llm/profile-builder.js';
import { logger } from '../logger.js';

export interface Job {
  id?: string;
  title: string;
  companyName?: string;
  companyUrl?: string;
  companyUrlDirect?: string;
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

// Valores válidos según la API de ever-jobs (enum Country)
const VALID_COUNTRIES = new Set([
  'ARGENTINA','AUSTRALIA','AUSTRIA','BAHRAIN','BANGLADESH','BELGIUM','BULGARIA','BRAZIL',
  'CANADA','CHILE','CHINA','COLOMBIA','COSTARICA','CROATIA','CYPRUS','CZECHREPUBLIC',
  'DENMARK','ECUADOR','EGYPT','ESTONIA','FINLAND','FRANCE','GERMANY','GREECE','HONGKONG',
  'HUNGARY','INDIA','INDONESIA','IRELAND','ISRAEL','ITALY','JAPAN','KUWAIT','LATVIA',
  'LITHUANIA','LUXEMBOURG','MALAYSIA','MALTA','MEXICO','MOROCCO','NETHERLANDS','NEWZEALAND',
  'NIGERIA','NORWAY','OMAN','PAKISTAN','PANAMA','PERU','PHILIPPINES','POLAND','PORTUGAL',
  'QATAR','ROMANIA','SAUDIARABIA','SINGAPORE','SLOVAKIA','SLOVENIA','SOUTHAFRICA','SOUTHKOREA',
  'SPAIN','SWEDEN','SWITZERLAND','TAIWAN','THAILAND','TURKEY','UKRAINE','UNITEDARABEMIRATES',
  'UK','USA','URUGUAY','VENEZUELA','VIETNAM','US_CANADA','WORLDWIDE',
]);

function sanitizeCountry(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    PERU: 'PERU', PERÚ: 'PERU',
    US: 'USA', UNITEDSTATES: 'USA', EEUU: 'USA',
    UK: 'UK', UNITEDKINGDOM: 'UK',
    LATINAMERICA: 'WORLDWIDE', LATAM: 'WORLDWIDE', GLOBAL: 'WORLDWIDE',
    SPAIN: 'SPAIN', ESPAÑA: 'SPAIN',
    MEXICO: 'MEXICO', MÉXICO: 'MEXICO',
    ARGENTINA: 'ARGENTINA', COLOMBIA: 'COLOMBIA', CHILE: 'CHILE',
  };
  const resolved = aliases[upper] ?? upper;
  return VALID_COUNTRIES.has(resolved) ? resolved : undefined;
}

export interface SearchOptions {
  sites: string[];
  remoteOnly: boolean;
  hoursOld: number;
}

export async function searchJobs(
  apiUrl: string,
  queries: SearchQuery[],
  resultsPerQuery: number,
  options: SearchOptions,
): Promise<Job[]> {
  const results = await Promise.allSettled(
    queries.map((q) => fetchJobs(apiUrl, q, resultsPerQuery, options)),
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

async function fetchJobs(
  apiUrl: string,
  query: SearchQuery,
  resultsPerQuery: number,
  options: SearchOptions,
): Promise<Job[]> {
  const country = sanitizeCountry(query.country);

  const body: Record<string, unknown> = {
    searchTerm: query.searchTerm,
    resultsWanted: resultsPerQuery,
    hoursOld: options.hoursOld,
    linkedinFetchDescription: false,
    siteType: options.sites,
    isRemote: options.remoteOnly,
  };

  if (query.location) body['location'] = query.location;
  if (country) body['country'] = country;

  logger.info(`Buscando: "${query.searchTerm}"${query.location ? ` en ${query.location}` : ''}${country ? ` [${country}]` : ''} | sites: ${options.sites.join(',')} | remote: ${options.remoteOnly}`);

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
  // ever-jobs pasa isRemote como hint al scraper pero no siempre tagea el campo en la respuesta
  // (LinkedIn lo omite aunque el job sea remoto). Solo descartamos los que explícitamente dicen false.
  const jobs = options.remoteOnly
    ? data.jobs.filter((j) => j.isRemote !== false)
    : data.jobs;
  logger.info(`  → ${jobs.length} empleos (${data.jobs.length} raw, filtro remoto: ${options.remoteOnly})`);
  return jobs;
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

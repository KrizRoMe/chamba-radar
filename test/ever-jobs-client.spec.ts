import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchJobs } from '../src/jobs/ever-jobs-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okResponse(jobs: object[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ jobs, count: jobs.length }),
  });
}

beforeEach(() => mockFetch.mockReset());

const DEFAULT_OPTS = {
  sites: ['linkedin', 'wellfound', 'remoteok', 'getonboard', 'indeed'],
  remoteOnly: true,
  hoursOld: 24,
};

describe('searchJobs', () => {
  const q = { searchTerm: 'engineer', hoursOld: 72 };
  const RESULTS_PER_QUERY = 5;

  it('devuelve jobs de una query exitosa', async () => {
    mockFetch.mockReturnValueOnce(okResponse([{ id: '1', title: 'SWE', companyName: 'Acme', isRemote: true }]));
    const jobs = await searchJobs('http://localhost:3001', [q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe('SWE');
  });

  it('filtra empleos presenciales cuando remoteOnly=true', async () => {
    mockFetch.mockReturnValueOnce(okResponse([
      { id: '1', title: 'Remote Job', isRemote: true },
      { id: '2', title: 'On-site Job', isRemote: false },
    ]));
    const jobs = await searchJobs('http://localhost:3001', [q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe('Remote Job');
  });

  it('siempre envía siteType, isRemote y hoursOld desde las opciones', async () => {
    mockFetch.mockReturnValueOnce(okResponse([]));
    await searchJobs('http://localhost:3001', [q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.siteType).toEqual(DEFAULT_OPTS.sites);
    expect(body.isRemote).toBe(true);
    expect(body.hoursOld).toBe(24);
  });

  it('usa resultsWanted = resultsPerQuery en el body', async () => {
    mockFetch.mockReturnValueOnce(okResponse([]));
    await searchJobs('http://localhost:3001', [q], 5, DEFAULT_OPTS);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.resultsWanted).toBe(5);
  });

  it('usa Promise.allSettled: una query falla, la otra responde', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockReturnValueOnce(okResponse([{ id: '2', title: 'Dev', companyName: 'Beta', isRemote: true }]));

    const jobs = await searchJobs('http://localhost:3001', [q, q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe('Dev');
  });

  it('deduplica por id', async () => {
    const job = { id: 'dup', title: 'Dup', companyName: 'X', isRemote: true };
    mockFetch
      .mockReturnValueOnce(okResponse([job]))
      .mockReturnValueOnce(okResponse([job]));
    const jobs = await searchJobs('http://localhost:3001', [q, q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(1);
  });

  it('deduplica por jobUrl cuando no hay id', async () => {
    const j1 = { title: 'A', companyName: 'X', jobUrl: 'https://example.com/1', isRemote: true };
    const j2 = { title: 'A', companyName: 'X', jobUrl: 'https://example.com/1', isRemote: true };
    mockFetch
      .mockReturnValueOnce(okResponse([j1]))
      .mockReturnValueOnce(okResponse([j2]));
    const jobs = await searchJobs('http://localhost:3001', [q, q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(1);
  });

  it('absorbe error si la respuesta no es ok', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('error') }),
    );
    const jobs = await searchJobs('http://localhost:3001', [q], RESULTS_PER_QUERY, DEFAULT_OPTS);
    expect(jobs).toHaveLength(0);
  });

  it('respeta remoteOnly=false (no filtra presenciales)', async () => {
    mockFetch.mockReturnValueOnce(okResponse([
      { id: '1', title: 'On-site', isRemote: false },
      { id: '2', title: 'Remote', isRemote: true },
    ]));
    const jobs = await searchJobs('http://localhost:3001', [q], RESULTS_PER_QUERY, { sites: ['linkedin'], remoteOnly: false, hoursOld: 48 });
    expect(jobs).toHaveLength(2);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.isRemote).toBe(false);
    expect(body.hoursOld).toBe(48);
  });
});

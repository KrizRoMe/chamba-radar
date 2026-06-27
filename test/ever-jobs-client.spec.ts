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

describe('searchJobs', () => {
  const q = { searchTerm: 'engineer', resultsWanted: 5, hoursOld: 72 };

  it('devuelve jobs de una query exitosa', async () => {
    mockFetch.mockReturnValueOnce(okResponse([{ id: '1', title: 'SWE', companyName: 'Acme' }]));
    const jobs = await searchJobs('http://localhost:3001', [q]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe('SWE');
  });

  it('usa Promise.allSettled: una query falla, la otra responde', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockReturnValueOnce(okResponse([{ id: '2', title: 'Dev', companyName: 'Beta' }]));

    const jobs = await searchJobs('http://localhost:3001', [q, q]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe('Dev');
  });

  it('deduplica por id', async () => {
    const job = { id: 'dup', title: 'Dup', companyName: 'X' };
    mockFetch
      .mockReturnValueOnce(okResponse([job]))
      .mockReturnValueOnce(okResponse([job]));
    const jobs = await searchJobs('http://localhost:3001', [q, q]);
    expect(jobs).toHaveLength(1);
  });

  it('deduplica por jobUrl cuando no hay id', async () => {
    const j1 = { title: 'A', companyName: 'X', jobUrl: 'https://example.com/1' };
    const j2 = { title: 'A', companyName: 'X', jobUrl: 'https://example.com/1' };
    mockFetch
      .mockReturnValueOnce(okResponse([j1]))
      .mockReturnValueOnce(okResponse([j2]));
    const jobs = await searchJobs('http://localhost:3001', [q, q]);
    expect(jobs).toHaveLength(1);
  });

  it('lanza si la respuesta no es ok', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('error') }),
    );
    const jobs = await searchJobs('http://localhost:3001', [q]);
    expect(jobs).toHaveLength(0);
  });
});

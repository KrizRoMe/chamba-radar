import { describe, it, expect } from 'vitest';
import { buildMessages } from '../src/format/message-builder.js';
import type { RankedJob } from '../src/llm/job-ranker.js';

function makeRanked(n: number): RankedJob[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `job-${i}`,
    score: 9 - i,
    reason: `Encaja porque tiene experiencia en área ${i}`,
    job: {
      id: `job-${i}`,
      title: `Software Engineer ${i}`,
      companyName: `Company ${i}`,
      jobUrl: `https://example.com/job/${i}`,
      location: { city: 'Lima, Peru' },
      isRemote: i % 2 === 0,
      datePosted: '2026-06-27',
    },
  }));
}

describe('buildMessages', () => {
  it('incluye header con fecha y resumen', () => {
    const msgs = buildMessages(makeRanked(1), 'Perfil de prueba');
    expect(msgs[0]).toContain('Chamba Radar');
    expect(msgs[0]).toContain('Perfil de prueba');
  });

  it('incluye título y empresa de cada empleo', () => {
    const msgs = buildMessages(makeRanked(3), 'Resumen');
    const full = msgs.join('\n');
    expect(full).toContain('Software Engineer 0');
    expect(full).toContain('Company 2');
  });

  it('respeta TOP_N y no duplica', () => {
    const msgs = buildMessages(makeRanked(5), 'Resumen');
    const full = msgs.join('\n');
    expect((full.match(/Software Engineer/g) ?? []).length).toBe(5);
  });

  it('parte en varios mensajes si supera 4000 chars', () => {
    const longReason = 'x'.repeat(900);
    const ranked: RankedJob[] = Array.from({ length: 6 }, (_, i) => ({
      id: `j${i}`,
      score: 9,
      reason: longReason,
      job: {
        id: `j${i}`,
        title: `Job ${i}`,
        companyName: 'Acme',
        jobUrl: `https://example.com/${i}`,
        location: { city: 'Lima' },
      },
    }));
    const msgs = buildMessages(ranked, 'Resumen');
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs) expect(m.length).toBeLessThanOrEqual(4000);
  });

  it('marca remoto correctamente', () => {
    const msgs = buildMessages(makeRanked(1), 'Resumen');
    expect(msgs[0]).toContain('Remoto');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { buildProfile } from '../src/llm/profile-builder.js';
import type { LlmClient } from '../src/llm/llm-client.js';

const bilingual = [
  { searchTerm: 'full stack engineer', location: 'Remote', isRemote: true, resultsWanted: 20, hoursOld: 72 },
  { searchTerm: 'backend developer NestJS', location: 'Lima', resultsWanted: 20, hoursOld: 72 },
  { searchTerm: 'desarrollador full stack', location: 'Lima, Perú', resultsWanted: 20, hoursOld: 72 },
  { searchTerm: 'ingeniero backend Node.js', isRemote: true, resultsWanted: 20, hoursOld: 72 },
];

const validProfile = {
  profileSummary: 'Desarrollador Full Stack con 4+ años en Next.js, NestJS y Django.',
  searchQueries: bilingual,
  hardFilters: { excludeKeywords: ['manager'], minSalaryUsd: 0 },
};

describe('buildProfile', () => {
  it('parsea y devuelve el perfil válido con 4+ queries', async () => {
    const llm: LlmClient = { chatJson: vi.fn().mockResolvedValueOnce(validProfile) };
    const result = await buildProfile(llm, 'CV content', 'Prefs content');
    expect(result.profileSummary).toBeTruthy();
    expect(result.searchQueries.length).toBeGreaterThanOrEqual(4);
  });

  it('incluye queries en inglés y español', async () => {
    const llm: LlmClient = { chatJson: vi.fn().mockResolvedValueOnce(validProfile) };
    const result = await buildProfile(llm, 'CV EN + ES', 'Prefs');
    const terms = result.searchQueries.map((q) => q.searchTerm);
    const hasEnglish = terms.some((t) => /engineer|developer|backend|full.?stack/i.test(t));
    const hasSpanish = terms.some((t) => /desarrollador|ingeniero|programador/i.test(t));
    expect(hasEnglish).toBe(true);
    expect(hasSpanish).toBe(true);
  });

  it('incluye hardFilters con defaults', async () => {
    const llm: LlmClient = { chatJson: vi.fn().mockResolvedValueOnce(validProfile) };
    const result = await buildProfile(llm, 'CV', 'Prefs');
    expect(result.hardFilters.excludeKeywords).toContain('manager');
    expect(result.hardFilters.minSalaryUsd).toBe(0);
  });

  it('llama a chatJson con el CV y las preferencias en el mensaje', async () => {
    const chatJson = vi.fn().mockResolvedValueOnce(validProfile);
    const llm: LlmClient = { chatJson };
    await buildProfile(llm, 'MI CV AQUI', 'MIS PREFERENCIAS AQUI');
    const messages = chatJson.mock.calls[0][1] as { role: string; content: string }[];
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toContain('MI CV AQUI');
    expect(userMsg?.content).toContain('MIS PREFERENCIAS AQUI');
  });

  it('el system prompt menciona búsquedas en inglés y español', async () => {
    const chatJson = vi.fn().mockResolvedValueOnce(validProfile);
    const llm: LlmClient = { chatJson };
    await buildProfile(llm, 'CV', 'Prefs');
    const messages = chatJson.mock.calls[0][1] as { role: string; content: string }[];
    const sysMsg = messages.find((m) => m.role === 'system');
    expect(sysMsg?.content).toContain('inglés');
    expect(sysMsg?.content).toContain('español');
  });
});

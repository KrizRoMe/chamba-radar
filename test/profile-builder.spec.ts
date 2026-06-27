import { describe, it, expect, vi } from 'vitest';
import { buildProfile } from '../src/llm/profile-builder.js';
import type { LlmClient } from '../src/llm/llm-client.js';

const validProfile = {
  profileSummary: 'Desarrollador con 5 años en TypeScript.',
  searchQueries: [
    { searchTerm: 'software engineer', location: 'Lima', resultsWanted: 20, hoursOld: 72 },
  ],
  hardFilters: { excludeKeywords: ['manager'], minSalaryUsd: 0 },
};

describe('buildProfile', () => {
  it('parsea y devuelve el perfil válido', async () => {
    const llm: LlmClient = { chatJson: vi.fn().mockResolvedValueOnce(validProfile) };
    const result = await buildProfile(llm, 'CV content', 'Prefs content');
    expect(result.profileSummary).toBe(validProfile.profileSummary);
    expect(result.searchQueries).toHaveLength(1);
    expect(result.searchQueries[0]?.searchTerm).toBe('software engineer');
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
});

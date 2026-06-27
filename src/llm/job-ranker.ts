import { z } from 'zod';
import type { LlmClient } from './llm-client.js';
import type { Job } from '../jobs/ever-jobs-client.js';
import type { Profile } from './profile-builder.js';

const RankedJobSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(10),
  reason: z.string(),
});

const RankingSchema = z.object({
  ranked: z.array(RankedJobSchema),
});

export type RankedJob = z.infer<typeof RankedJobSchema> & { job: Job };

export async function rankJobs(
  llm: LlmClient,
  jobs: Job[],
  profile: Profile,
  topN: number,
): Promise<RankedJob[]> {
  const filtered = applyHardFilters(jobs, profile);

  if (filtered.length === 0) return [];

  const jobList = filtered.slice(0, 80).map((j, i) => ({
    index: i,
    id: j.id ?? j.jobUrl ?? String(i),
    title: j.title,
    company: j.companyName,
    location: j.location?.city ?? j.location?.country ?? 'N/A',
    isRemote: j.isRemote,
    datePosted: j.datePosted,
  }));

  const result = await llm.chatJson(RankingSchema, [
    {
      role: 'system',
      content: `Eres un experto en reclutamiento. Dado el perfil de un candidato y una lista de empleos,
rankea los mejores empleos del 0 al 10 según qué tan bien encajan con el perfil.
Responde SOLO con JSON válido: { "ranked": [{ "id": "...", "score": 8.5, "reason": "..." }] }
Incluye solo los top ${topN} mejores empleos. La razón debe ser 1 oración concisa en español.`,
    },
    {
      role: 'user',
      content: `Perfil: ${profile.profileSummary}\n\nEmpleos:\n${JSON.stringify(jobList, null, 2)}`,
    },
  ]);

  const jobMap = new Map(filtered.map((j) => [j.id ?? j.jobUrl, j]));

  return result.ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((r) => ({ ...r, job: jobMap.get(r.id) ?? filtered[Number(r.id)] ?? filtered[0]! }))
    .filter((r) => r.job != null);
}

function applyHardFilters(jobs: Job[], profile: Profile): Job[] {
  const { excludeKeywords, minSalaryUsd } = profile.hardFilters;
  const excludeLower = excludeKeywords.map((k) => k.toLowerCase());

  return jobs.filter((j) => {
    const text = `${j.title} ${j.companyName ?? ''}`.toLowerCase();
    if (excludeLower.some((kw) => text.includes(kw))) return false;
    if (minSalaryUsd > 0 && j.compensation) {
      const min = j.compensation.minAmount ?? 0;
      if (min > 0 && min < minSalaryUsd) return false;
    }
    return true;
  });
}

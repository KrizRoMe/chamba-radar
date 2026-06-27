import { z } from 'zod';
import type { LlmClient } from './llm-client.js';

const SearchQuerySchema = z.object({
  searchTerm: z.string(),
  location: z.string().optional(),
  isRemote: z.boolean().optional(),
  country: z.string().optional(),
  resultsWanted: z.number().int().positive().default(20),
  hoursOld: z.number().int().positive().default(72),
  siteType: z.array(z.string()).optional(),
});

const HardFiltersSchema = z.object({
  excludeKeywords: z.array(z.string()).default([]),
  minSalaryUsd: z.number().default(0),
});

const ProfileSchema = z.object({
  profileSummary: z.string(),
  searchQueries: z.array(SearchQuerySchema).min(1),
  hardFilters: HardFiltersSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export async function buildProfile(
  llm: LlmClient,
  cvContent: string,
  preferencesContent: string,
): Promise<Profile> {
  return llm.chatJson(ProfileSchema, [
    {
      role: 'system',
      content: `Eres un asistente experto en búsqueda de empleo.
Dado un CV y preferencias laborales, genera un objeto JSON con:
- profileSummary: resumen breve en 2-3 oraciones del candidato y su perfil
- searchQueries: array de 2-4 búsquedas óptimas para encontrar empleos relevantes
  (campos: searchTerm, location, isRemote, country, resultsWanted, hoursOld, siteType)
- hardFilters: filtros excluyentes (excludeKeywords, minSalaryUsd)

Responde SOLO con el JSON válido, sin explicaciones ni markdown extra.`,
    },
    {
      role: 'user',
      content: `CV:\n${cvContent}\n\n---\n\nPreferencias:\n${preferencesContent}`,
    },
  ]);
}

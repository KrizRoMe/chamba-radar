import { z } from 'zod';
import type { LlmClient } from './llm-client.js';

const SearchQuerySchema = z.object({
  searchTerm: z.string(),
  location: z.string().optional(),
  country: z.string().optional(),
});

const HardFiltersSchema = z.object({
  excludeKeywords: z.array(z.string()).default([]),
  minSalaryUsd: z.number().default(0),
});

const ProfileSchema = z.object({
  profileSummary: z.string(),
  searchQueries: z.array(SearchQuerySchema).min(4),
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
      content: `Eres un asistente experto en búsqueda de empleo internacional.
Dado un CV (puede estar en inglés y español) y preferencias laborales, genera un objeto JSON con:
- profileSummary: resumen breve en 2-3 oraciones del candidato y su perfil (en español)
- searchQueries: array de 4-6 búsquedas óptimas que cubran TANTO inglés COMO español.
  Reglas obligatorias:
  * Al menos 2 queries con searchTerm en INGLÉS (ej: "full stack engineer", "backend developer")
  * Al menos 2 queries con searchTerm en ESPAÑOL (ej: "desarrollador full stack", "ingeniero backend")
  * Varía los términos: usa sinónimos, tecnologías clave del CV, y diferentes niveles de especificidad
  * Campos disponibles: searchTerm, location, country
  * IMPORTANTE — country debe ser exactamente uno de estos valores en MAYÚSCULAS: PERU, USA, UK, SPAIN, MEXICO, ARGENTINA, COLOMBIA, CHILE, WORLDWIDE. Si no aplica, omite el campo.
  * location es texto libre (ciudad, país), úsalo solo si la búsqueda requiere una ubicación específica.
  * NO incluyas campos isRemote, siteType ni hoursOld — esos se controlan externamente.
- hardFilters: filtros excluyentes (excludeKeywords, minSalaryUsd)

Responde SOLO con el JSON válido, sin explicaciones ni markdown extra.`,
    },
    {
      role: 'user',
      content: `CV:\n${cvContent}\n\n---\n\nPreferencias:\n${preferencesContent}`,
    },
  ]);
}

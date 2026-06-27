import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  llm: z.object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url().default('https://api.minimax.io/v1'),
    model: z.string().default('MiniMax-M2.1'),
  }),
  everJobs: z.object({
    apiUrl: z.string().url().default('http://localhost:3001'),
  }),
  whareminder: z.object({
    baseUrl: z.string().url().default('https://api.whareminder.com'),
    apiKey: z.string().min(1),
    sessionId: z.string().min(1),
    templateId: z.string().min(1),
  }),
  whatsapp: z.object({
    targetPhone: z.string().default('51986550234'),
  }),
  data: z.object({
    cvPath: z.string().default('data/cv.md'),
    cvEsPath: z.string().optional(),
    preferencesPath: z.string().default('data/preferences.md'),
  }),
  topN: z.coerce.number().int().positive().default(5),
  resultsPerQuery: z.coerce.number().int().positive().default(5),
  dryRun: z.boolean().default(false),
  search: z.object({
    sites: z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
    remoteOnly: z.boolean(),
    hoursOld: z.coerce.number().int().positive().default(24),
  }),
});

function loadConfig() {
  const result = schema.safeParse({
    llm: {
      apiKey: process.env['LLM_API_KEY'],
      baseUrl: process.env['LLM_BASE_URL'],
      model: process.env['LLM_MODEL'],
    },
    everJobs: {
      apiUrl: process.env['EVER_JOBS_API_URL'],
    },
    whareminder: {
      baseUrl: process.env['WHAREMINDER_BASE_URL'],
      apiKey: process.env['WHAREMINDER_API_KEY'],
      sessionId: process.env['WHAREMINDER_SESSION_ID'],
      templateId: process.env['WHAREMINDER_TEMPLATE_ID'],
    },
    whatsapp: {
      targetPhone: process.env['WHATSAPP_TARGET_PHONE'],
    },
    data: {
      cvPath: process.env['CV_PATH'],
      cvEsPath: process.env['CV_ES_PATH'],
      preferencesPath: process.env['PREFERENCES_PATH'],
    },
    topN: process.env['TOP_N_RESULTS'],
    resultsPerQuery: process.env['RESULTS_PER_QUERY'],
    dryRun: process.env['DRY_RUN'] === '1',
    search: {
      sites: process.env['SEARCH_SITES'] ?? 'linkedin,indeed,wellfound,remoteok,getonboard',
      remoteOnly: process.env['REMOTE_ONLY'] !== '0',
      hoursOld: process.env['HOURS_OLD'],
    },
  });

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Config inválida o variables faltantes:\n${missing}`);
  }

  return result.data;
}

export type Config = ReturnType<typeof loadConfig>;
export const config = loadConfig();

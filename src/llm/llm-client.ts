import OpenAI from 'openai';
import { z } from 'zod';
import type { Config } from '../config.js';

export type LlmClient = ReturnType<typeof createLlmClient>;

export function createLlmClient(cfg: Config['llm']) {
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl,
  });

  async function chatJson<T>(
    schema: z.ZodType<T>,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    retries = 1,
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await client.chat.completions.create({
        model: cfg.model,
        messages,
        temperature: 0.2,
      });

      const raw = res.choices[0]?.message?.content ?? '';
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0] ?? raw) : raw;

      try {
        const parsed: unknown = JSON.parse(jsonStr.trim());
        const validated = schema.safeParse(parsed);
        if (validated.success) return validated.data;
        if (attempt < retries) continue;
        throw new Error(`Schema inválido: ${validated.error.message}\nRaw: ${raw}`);
      } catch (err) {
        if (attempt < retries) continue;
        throw err;
      }
    }
    throw new Error('chatJson: agotados los reintentos');
  }

  return { chatJson };
}

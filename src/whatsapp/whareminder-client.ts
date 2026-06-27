import type { Config } from '../config.js';
import { logger } from '../logger.js';

export async function sendWhatsApp(
  cfg: Config['whareminder'] & { phone: string },
  content: string,
): Promise<void> {
  // Schedule con sendAt = ahora + 30 segundos para entrega inmediata
  const sendAt = new Date(Date.now() + 30_000).toISOString();

  const url = `${cfg.baseUrl}/sessions/${cfg.sessionId}/schedules`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      templateId: cfg.templateId,
      phone: cfg.phone,
      variables: { content },
      sendAt,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`whareminder respondió ${res.status}: ${body}`);
  }

  logger.info(`WhatsApp agendado para ${cfg.phone} en ${sendAt} (${content.length} chars)`);
}

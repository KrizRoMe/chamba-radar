import type { RankedJob } from '../llm/job-ranker.js';

const MAX_MSG_CHARS = 4000;

export function buildMessages(ranked: RankedJob[], profileSummary: string): string[] {
  const today = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const header = `🎯 *Chamba Radar* — ${today}\n${profileSummary}\n\n*Top ${ranked.length} empleos del día:*\n\n`;

  const cards = ranked.map((r, i) => {
    const j = r.job;
    const loc = j.isRemote
      ? '🌐 Remoto'
      : j.location?.city ?? j.location?.country ?? 'N/A';
    const salary = j.compensation?.minAmount
      ? ` · 💰 ${j.compensation.currency ?? '$'}${j.compensation.minAmount.toLocaleString()}`
      : '';
    const date = j.datePosted ? ` · 📅 ${j.datePosted}` : '';
    const link = j.jobUrl ? `\n🔗 ${j.jobUrl}` : '';

    return `*${i + 1}. ${j.title}*\n🏢 ${j.companyName ?? 'N/A'} · 📍 ${loc}${salary}${date}\n💡 ${r.reason}${link}`;
  });

  return splitIntoMessages(header, cards);
}

function splitIntoMessages(header: string, cards: string[]): string[] {
  const messages: string[] = [];
  let current = header;

  for (const card of cards) {
    const separator = '\n\n---\n\n';
    if ((current + separator + card).length > MAX_MSG_CHARS && current !== header) {
      messages.push(current.trimEnd());
      current = card;
    } else {
      current = current === header ? header + card : current + separator + card;
    }
  }

  if (current.trim()) messages.push(current.trimEnd());
  return messages;
}

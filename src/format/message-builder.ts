import type { RankedJob } from '../llm/job-ranker.js';

const MAX_MSG_CHARS = 4000;

export function buildMessages(ranked: RankedJob[], profileSummary: string): string[] {
  const today = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const header = `🎯 *Chamba Radar* — ${today}\n\n`;

  const cards = ranked.map((r, i) => {
    const j = r.job;
    const companyLine = j.companyName ?? 'N/A';
    const applyUrl = j.jobUrl ?? '';
    const companyUrl = j.companyUrlDirect ?? j.companyUrl ?? '';

    let card = `*${i + 1}. ${j.title}*\n🏢 ${companyLine}\n💡 ${r.reason}`;
    if (applyUrl) card += `\n🔗 ${applyUrl}`;
    if (companyUrl) card += `\n🌐 ${companyUrl}`;
    return card;
  });

  return splitIntoMessages(header, cards);
}

function splitIntoMessages(header: string, cards: string[]): string[] {
  const messages: string[] = [];
  let current = header;

  for (const card of cards) {
    const separator = '\n\n';
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

import { readFile } from 'fs/promises';
import { config } from './config.js';
import { logger } from './logger.js';
import { createLlmClient } from './llm/llm-client.js';
import { buildProfile } from './llm/profile-builder.js';
import { rankJobs } from './llm/job-ranker.js';
import { searchJobs } from './jobs/ever-jobs-client.js';
import { buildMessages } from './format/message-builder.js';
import { sendWhatsApp } from './whatsapp/whareminder-client.js';

async function main() {
  logger.info('=== Chamba Radar iniciando ===');

  // 1. Leer CV(s) y preferencias
  const [cvEn, cvEs, preferencesContent] = await Promise.all([
    readFile(config.data.cvPath, 'utf-8'),
    config.data.cvEsPath ? readFile(config.data.cvEsPath, 'utf-8').catch(() => null) : Promise.resolve(null),
    readFile(config.data.preferencesPath, 'utf-8'),
  ]);

  const cvContent = cvEs
    ? `${cvEn}\n\n---\n\n## CV en Español\n\n${cvEs}`
    : cvEn;

  logger.info(`CV cargado (${cvContent.length} chars${cvEs ? ', bilingüe EN+ES' : ''}), preferencias (${preferencesContent.length} chars)`);

  // 2. Construir perfil y queries con IA
  const llm = createLlmClient(config.llm);
  logger.info(`Construyendo perfil con ${config.llm.model}...`);
  const profile = await buildProfile(llm, cvContent, preferencesContent);
  logger.info(`Perfil: ${profile.profileSummary}`);
  logger.info(`Queries generadas: ${profile.searchQueries.length}`);

  // 3. Buscar empleos en ever-jobs
  logger.info(`Buscando empleos en ${config.everJobs.apiUrl} (${config.resultsPerQuery} por query, sites: ${config.search.sites.join(',')}, remoto: ${config.search.remoteOnly}, últimas ${config.search.hoursOld}h)...`);
  const jobs = await searchJobs(config.everJobs.apiUrl, profile.searchQueries, config.resultsPerQuery, config.search);
  logger.info(`Total empleos únicos: ${jobs.length}`);

  if (jobs.length === 0) {
    logger.warn('No se encontraron empleos. Abortando envío.');
    process.exit(0);
  }

  // 4. Rankear con IA
  logger.info(`Rankeando top ${config.topN} con IA...`);
  const ranked = await rankJobs(llm, jobs, profile, config.topN);
  logger.info(`Empleos rankeados: ${ranked.length}`);

  if (ranked.length === 0) {
    logger.warn('Ningún empleo pasó el ranking. Abortando envío.');
    process.exit(0);
  }

  // 5. Construir mensajes
  const messages = buildMessages(ranked, profile.profileSummary);
  logger.info(`Mensajes WhatsApp a enviar: ${messages.length}`);

  // 6. Enviar (o dry-run)
  if (config.dryRun) {
    logger.info('=== DRY-RUN: mensajes que se enviarían ===');
    for (const [i, msg] of messages.entries()) {
      console.log(`\n--- Mensaje ${i + 1}/${messages.length} ---\n${msg}`);
    }
  } else {
    const whatsappCfg = {
      ...config.whareminder,
      phone: config.whatsapp.targetPhone,
    };
    for (const [i, msg] of messages.entries()) {
      logger.info(`Enviando mensaje ${i + 1}/${messages.length}...`);
      await sendWhatsApp(whatsappCfg, msg);
    }
  }

  logger.info(`=== Chamba Radar completado: ${ranked.length} empleos, ${messages.length} mensajes ===`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

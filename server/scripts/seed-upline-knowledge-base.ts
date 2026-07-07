import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  createKevinApprovedKnowledgeSource,
  KNOWLEDGE_SOURCE_COLLECTION,
} from '../src/services/knowledge/approvedKnowledgeStore.js';
import { ensureChromaCollections } from '../src/services/chromaCollections.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import {
  closeDirectPersistence,
  connectDirectPersistence,
} from '../src/services/persistence/index.js';
import { extractKnowledgeFile } from '../src/runtime/knowledge/knowledgeFileExtraction.js';
import type {
  McsAgentKey,
  McsKnowledgeDomain,
  McsRuntimeLanguage,
} from '@momentum/shared/runtime';

interface MongoQueryResult {
  count?: number;
  documents?: Array<Record<string, unknown>>;
}

interface UplineKnowledgeSeedItem {
  path: string;
  title: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  topicTags: string[];
  agentScopes: McsAgentKey[];
}

// Upline reference corpus — Legacy Makers onboarding hub (rlegacymakers.com),
// captured 2026-07-07 per DECISION_upline_onboarding_infusion / ACR-0011.
// Curriculum structure reference only; Team Magnificent authors its own branded versions.
const UPLINE_ROOT = 'D:/momentum-creation-system-v2/knowledge/upline-legacy-makers';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';
const INGESTED_AT = new Date().toISOString();

const MI: McsAgentKey[] = ['michael_magnificent', 'ivory'];
const SM: McsAgentKey[] = ['steve_success', 'michael_magnificent'];
const M: McsAgentKey[] = ['michael_magnificent'];

const scriptItem = (
  file: string,
  title: string,
  tags: string[],
  scopes: McsAgentKey[] = MI,
): UplineKnowledgeSeedItem => ({
  path: file,
  title,
  domain: 'training',
  language: 'en',
  topicTags: ['upline-reference', '5-point-system', ...tags],
  agentScopes: scopes,
});

const ITEMS: UplineKnowledgeSeedItem[] = [
  scriptItem('getting-started-checklist.pdf', 'Upline: Getting Started Checklist', ['onboarding', 'checklist'], SM),
  scriptItem('start-messaging.pdf', 'Upline: Start Messaging Guide', ['messaging', 'invitation', 'scripts']),
  scriptItem('how-to-use-glp-three.pdf', 'Upline: How to Use GLP-THREE', ['glp-three', 'product-usage']),
  scriptItem('qba-goal-sheet.pdf', 'Upline: QBA Goal Sheet', ['qba', 'goals'], SM),
  scriptItem('create-your-names-list.pdf', 'Upline: Create Your Names List', ['names-list', 'prospecting']),
  scriptItem('share-your-story.pdf', 'Upline: Share Your Story', ['story', 'testimonial']),
  scriptItem('basic-dmo.pdf', 'Upline: Basic DMO (Daily Method of Operations)', ['dmo', 'daily-actions'], M),
  scriptItem('core3-promo-flyer-three-corporate.pdf', 'THREE: CORE 3 Double Promo Flyer', ['core3', 'promotion', 'three-corporate'], M),
  scriptItem('follow-up-call-guide-three-way-script.pdf', 'Upline: Follow Up Call Guide / Three Way Call Script', ['follow-up', 'three-way-call', 'scripts']),
  scriptItem('closing-scripts-v1.pdf', 'Upline: Closing Scripts (v1)', ['closing', 'scripts']),
  scriptItem('closing-scripts-v2.pdf', 'Upline: Closing Scripts (v2)', ['closing', 'scripts']),
  scriptItem('overcoming-objections.pdf', 'Upline: Overcoming Objections', ['objections', 'scripts']),
  {
    path: 'welcome-letter.pdf',
    title: 'Upline: New BA Welcome Letter',
    domain: 'organizational',
    language: 'en',
    topicTags: ['upline-reference', '5-point-system', 'welcome', 'onboarding'],
    agentScopes: SM,
  },
  {
    path: 'enrollment-form.pdf',
    title: 'Upline: Enrollment Form',
    domain: 'organizational',
    language: 'en',
    topicTags: ['upline-reference', '5-point-system', 'enrollment', 'form'],
    agentScopes: SM,
  },
  scriptItem('launch-invite.pdf', 'Upline: Launch Invite', ['launch', 'invite', 'scripts']),
  scriptItem('social-text-to-close-scripts.pdf', 'Upline: Social Text to Close Scripts', ['texting', 'closing', 'scripts']),
  scriptItem('health-professional-script.pdf', 'Upline: Health Professional Script', ['healthcare-professional', 'scripts']),
  scriptItem('patient-client-script.pdf', 'Upline: Patient/Client Script', ['patient-client', 'healthcare', 'scripts']),
  scriptItem('quick-talking-points.pdf', 'Upline: Quick Talking Points', ['talking-points', 'scripts']),
  scriptItem('business-approach-script.pdf', 'Upline: Business Approach Script', ['business-approach', 'scripts']),
  scriptItem('carpe-diem-script.pdf', 'Upline: Carpe Diem Script', ['scripts']),
  scriptItem('scripts-for-life.pdf', 'Upline: Scripts for Life', ['scripts']),
  scriptItem('connecting-script.pdf', 'Upline: Connecting Script', ['connecting', 'inviting', 'scripts']),
  scriptItem('in-person-event-invite.pdf', 'Upline: In Person Event Invite', ['events', 'invite', 'scripts']),
  ...(['t1', 't2', 't3', 't4', 't5', 't6', 't8'] as const).map((t) =>
    scriptItem(`tracker-${t}.pdf`, `Upline: Tracker Form ${t.toUpperCase()}`, ['tracker', 'forms'], M),
  ),
  scriptItem('tracker-t7.docx', 'Upline: Tracker Form T7', ['tracker', 'forms'], M),
  scriptItem('tracker-t9.docx', 'Upline: Tracker Form T9', ['tracker', 'forms'], M),
];

async function main(): Promise<void> {
  await connectDirectPersistence();
  await ensureChromaCollections();

  const report = { created: 0, skipped: 0, failed: 0, chunks: 0 };

  try {
    for (const item of ITEMS) {
      const fullPath = path.resolve(UPLINE_ROOT, item.path);
      const sourceRef = `file:${fullPath.replace(/\\/g, '/')}`;
      if (await alreadyIngested(sourceRef)) {
        report.skipped += 1;
        console.log(`[upline-kb] skip existing ${item.title}`);
        continue;
      }

      try {
        const bytes = await readFile(fullPath);
        const info = await stat(fullPath);
        const extracted = await extractKnowledgeFile({ filename: fullPath, bytes });

        const result = await createKevinApprovedKnowledgeSource({
          title: item.title,
          content: extracted.content,
          createdBy: CREATED_BY,
          authorityKind: 'kevin_approved',
          authorityBy: AUTHORITY_BY,
          authorityRef: `upline-legacy-makers:${item.path}`,
          sourceType: 'owned_text',
          sourceRef,
          domain: item.domain,
          language: item.language,
          format: extracted.kind,
          topicTags: item.topicTags,
          agentScopes: item.agentScopes,
          upload: {
            filename: path.basename(fullPath),
            originalBytes: info.size,
            extractedCharacters: extracted.content.length,
            sourceRef,
          },
          createdAt: INGESTED_AT,
        });

        report.created += 1;
        report.chunks += result.chunkCount;
        console.log(`[upline-kb] created ${item.title} (${result.chunkCount} chunks)`);
      } catch (err) {
        report.failed += 1;
        console.error(
          `[upline-kb] failed ${item.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(
      `[upline-kb] complete created=${report.created} skipped=${report.skipped} ` +
        `failed=${report.failed} chunks=${report.chunks}`,
    );
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await closeDirectPersistence();
  }
}

async function alreadyIngested(sourceRef: string): Promise<boolean> {
  const result = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
    database: 'momentum',
    collection: KNOWLEDGE_SOURCE_COLLECTION,
    filter: { sourceRef },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

main().catch(async (err) => {
  console.error(`[upline-kb] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});

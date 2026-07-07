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

interface ThreeKnowledgeSeedItem {
  path: string;
  title: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  topicTags: string[];
  agentScopes: McsAgentKey[];
  sourceType?: 'owned_text' | 'tm_training_page' | 'note';
}

const THREE_ROOT = 'D:/THREE';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';
const INGESTED_AT = new Date().toISOString();

const ITEMS: ThreeKnowledgeSeedItem[] = [
  {
    path: 'policies/compliance.md',
    title: 'THREE Compliance Analysis for Team Magnificent',
    domain: 'governance',
    language: 'en',
    topicTags: ['compliance', 'policies', 'team-magnificent'],
    agentScopes: ['steve_success', 'michael_magnificent', 'ivory'],
    sourceType: 'note',
  },
  {
    path: 'policies/PoliciesAndProcedures_V5.pdf',
    title: 'THREE Policies and Procedures V5',
    domain: 'governance',
    language: 'en',
    topicTags: ['policies', 'compliance', 'brand-ambassador'],
    agentScopes: ['steve_success', 'michael_magnificent', 'ivory'],
  },
  {
    path: 'policies/Do_and_dont_income_story_FNL.pdf',
    title: 'THREE Do and Do Not: Income Story',
    domain: 'governance',
    language: 'en',
    topicTags: ['income-claims', 'compliance', 'story'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'policies/Do_and_dont_PRODUCT_story_FNL.pdf',
    title: 'THREE Do and Do Not: Product Story',
    domain: 'governance',
    language: 'en',
    topicTags: ['product-claims', 'compliance', 'story'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  ...[
    ['VITALITE', 'Do_and_dont_product_page_VITALITE_FNL.pdf'],
    ['REVIVE', 'Do_and_dont_product_page_REVIVE_FNL.pdf'],
    ['PURIFI', 'Do_and_dont_product_page_PURIFI_FNL.pdf'],
    ['IMUNE', 'Do_and_dont_product_page_IMUNE_FNL.pdf'],
    ['COLLAGENE', 'Do_and_dont_product_page_COLLAGENE_FNL.pdf'],
    ['ETERNEL', 'Do_and_dont_product_page_ETERNEL_FNL.pdf'],
  ].map(([name, filename]) => ({
    path: `policies/${filename}`,
    title: `THREE Do and Do Not: ${name} Product Page`,
    domain: 'governance' as McsKnowledgeDomain,
    language: 'en' as McsRuntimeLanguage,
    topicTags: ['product-claims', 'compliance', name.toLowerCase()],
    agentScopes: ['michael_magnificent', 'ivory'] as McsAgentKey[],
  })),
  {
    path: 'trainings/10_Steps_for_Success.html',
    title: 'Team Magnificent 10 Steps for Success',
    domain: 'training',
    language: 'en',
    topicTags: ['orientation', 'success-steps', 'training'],
    agentScopes: ['steve_success', 'michael_magnificent'],
    sourceType: 'tm_training_page',
  },
  {
    path: 'training-materials/THREE-ACTION-PLAN-Sheet.pdf',
    title: 'THREE Action Plan Sheet',
    domain: 'training',
    language: 'en',
    topicTags: ['action-plan', 'training'],
    agentScopes: ['steve_success', 'michael_magnificent'],
  },
  {
    path: 'compensation/1-page-business-sheet_v3_FNL.pdf',
    title: 'THREE One Page Business Sheet',
    domain: 'training',
    language: 'en',
    topicTags: ['business-overview', 'compensation', 'training'],
    agentScopes: ['michael_magnificent'],
  },
  {
    path: 'compensation/2507_V11_FinancialRewardsPlan_NAM_ENG_01.pdf',
    title: 'THREE Financial Rewards Plan NAM English',
    domain: 'training',
    language: 'en',
    topicTags: ['compensation', 'rewards-plan', 'team-only'],
    agentScopes: ['michael_magnificent'],
  },
  {
    path: 'promotions/2by2_Flyer_ENG.pdf',
    title: 'THREE 2 by 2 Flyer English',
    domain: 'training',
    language: 'en',
    topicTags: ['2by2', 'training', 'promotion'],
    agentScopes: ['michael_magnificent'],
  },
  {
    path: 'promotions/CustomerProgramFlyer_02-1.pdf',
    title: 'THREE Customer Program Flyer',
    domain: 'training',
    language: 'en',
    topicTags: ['customer-program', 'promotion', 'official-flyer'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'research/cellular_absorption_study_sheet_03.pdf',
    title: 'THREE Cellular Absorption Study Sheet',
    domain: 'training',
    language: 'en',
    topicTags: ['science', 'cellular-absorption', 'official-study-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'clinical-studies/Imune-Curated-Blend-and-CAT-Clinical-Study-Dossier.pdf',
    title: 'THREE Imune Curated Blend and CAT Clinical Study Dossier',
    domain: 'training',
    language: 'en',
    topicTags: ['science', 'imune', 'clinical-study', 'official-dossier'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2601_FactSheet-GLPTHREE_v1_ENG_FNL.pdf',
    title: 'THREE GLP-THREE Fact Sheet English',
    domain: 'training',
    language: 'en',
    topicTags: ['glp-three', 'product', 'official-fact-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2601_FAQSheet-GLP-THREE_v1_ENG_FNL.pdf',
    title: 'THREE GLP-THREE FAQ Sheet English',
    domain: 'training',
    language: 'en',
    topicTags: ['glp-three', 'product-faq', 'official-faq'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2301V1_ProductFactSheets.pdf',
    title: 'THREE Product Fact Sheets Collection',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'official-fact-sheet', 'collection'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2303V1_Product-Price-Sheet_ENG_01.pdf',
    title: 'THREE Product Price Sheet English',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'price-sheet', 'official-reference'],
    agentScopes: ['michael_magnificent'],
  },
  {
    path: 'products/2408V1_FactSheet-Visage_ENG_01.pdf',
    title: 'THREE Visage Fact Sheet English',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'visage', 'official-fact-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2410V1_FactSheet-Visage_Pure-Cleanse_FNL.pdf',
    title: 'THREE Visage Pure Cleanse Fact Sheet',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'visage', 'pure-cleanse', 'official-fact-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2410V1_FactSheet-Visage_Radiant-Toner_ENG_FNL.pdf',
    title: 'THREE Visage Radiant Toner Fact Sheet English',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'visage', 'radiant-toner', 'official-fact-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/2503v1_FAQ-Visage_creme-caviar_ENG_FNL.pdf',
    title: 'THREE Visage Creme Caviar FAQ English',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'visage', 'creme-caviar', 'official-faq'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  {
    path: 'products/Collagene-focus-group-sheet_FNL.pdf',
    title: 'THREE Collagene Focus Group Sheet',
    domain: 'training',
    language: 'en',
    topicTags: ['product', 'collagene', 'focus-group', 'official-sheet'],
    agentScopes: ['michael_magnificent', 'ivory'],
  },
  ...[
    ['VITALITE', 'products/vitalite.pdf'],
    ['REVIVE', 'products/Revive.pdf'],
    ['PURIFI', 'products/purifi.pdf'],
    ['ETERNEL', 'products/eternel.pdf'],
    ['COLLAGENE', 'products/collagene.pdf'],
    ['IMUNE', 'products/2306V2_FactSheet-Imune_ENG_08.pdf'],
  ].map(([name, relPath]) => ({
    path: relPath,
    title: `THREE ${name} Product Fact Sheet`,
    domain: 'training' as McsKnowledgeDomain,
    language: 'en' as McsRuntimeLanguage,
    topicTags: ['product', 'official-fact-sheet', name.toLowerCase()],
    agentScopes: ['michael_magnificent', 'ivory'] as McsAgentKey[],
  })),
  {
    path: 'presentation/rev-3THREE-PRESENTATION-BAs.pdf',
    title: 'THREE Brand Ambassador Presentation',
    domain: 'training',
    language: 'en',
    topicTags: ['presentation', 'brand-ambassador', 'official-training'],
    agentScopes: ['steve_success', 'michael_magnificent', 'ivory'],
  },
  {
    path: 'enrollment-forms for ba/251126_EnrollmentForm_Simple6_NAM_v1.pdf',
    title: 'THREE Enrollment Form Simple 6 NAM',
    domain: 'organizational',
    language: 'en',
    topicTags: ['enrollment', 'brand-ambassador', 'official-form'],
    agentScopes: ['steve_success', 'michael_magnificent'],
  },
  {
    path: 'business-card-template/THREE-Brand-Ambassador-Business-Cards.pdf',
    title: 'THREE Brand Ambassador Business Card Template',
    domain: 'organizational',
    language: 'en',
    topicTags: ['business-card', 'brand-ambassador', 'official-template'],
    agentScopes: ['michael_magnificent'],
  },
  {
    path: 'calendar/2026-calendar.pdf',
    title: 'THREE 2026 Calendar',
    domain: 'organizational',
    language: 'en',
    topicTags: ['calendar', 'events', 'official-reference'],
    agentScopes: ['steve_success', 'michael_magnificent'],
  },
  {
    path: 'compensation/nueva-comp.pdf',
    title: 'THREE Nueva Compensation Plan',
    domain: 'training',
    language: 'es',
    topicTags: ['compensation', 'rewards-plan', 'spanish', 'team-only'],
    agentScopes: ['michael_magnificent'],
  },
];

async function main(): Promise<void> {
  await connectDirectPersistence();
  await ensureChromaCollections();

  const report = {
    created: 0,
    skipped: 0,
    failed: 0,
    chunks: 0,
  };

  try {
    for (const item of ITEMS) {
      const fullPath = path.resolve(THREE_ROOT, item.path);
      const sourceRef = `file:${fullPath.replace(/\\/g, '/')}`;
      if (await alreadyIngested(sourceRef)) {
        report.skipped += 1;
        console.log(`[three-kb] skip existing ${item.title}`);
        continue;
      }

      try {
        const bytes = await readFile(fullPath);
        const info = await stat(fullPath);
        const extracted = await extractKnowledgeFile({
          filename: fullPath,
          bytes,
        });

        const result = await createKevinApprovedKnowledgeSource({
          title: item.title,
          content: extracted.content,
          createdBy: CREATED_BY,
          authorityKind: 'kevin_approved',
          authorityBy: AUTHORITY_BY,
          authorityRef: `three-corpus:${item.path}`,
          sourceType: item.sourceType ?? 'owned_text',
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
        console.log(`[three-kb] created ${item.title} (${result.chunkCount} chunks)`);
      } catch (err) {
        report.failed += 1;
        console.error(
          `[three-kb] failed ${item.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(
      `[three-kb] complete created=${report.created} skipped=${report.skipped} ` +
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
  console.error(`[three-kb] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});

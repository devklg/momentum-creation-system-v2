import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanGeneratedCopyCompliance } from '../../domain/generatedCopyCompliance.js';
import { buildManualCsv } from '../../services/vmProviders/manualCsv.js';

const repoRoot = path.resolve(process.cwd(), '..');
const read = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8');

describe('P1 VM/RVM copy compliance', () => {
  it.each([
    ['income', 'This can make $1000 a month.'],
    ['comp_plan', 'The compensation plan pays binary commissions.'],
    ['placement', 'Act now to save your queue position.'],
    ['ai_qualification', 'You are an AI-qualified prospect.'],
    ['three_handoff', 'The app will enroll you into THREE International.'],
    ['medical', 'This is guaranteed to cure you.'],
    ['pressure', "Hurry, don't miss out."],
    ['automation', 'The system will call and follow up.'],
  ])('blocks %s claims in prospect-bound VM/RVM language', (rule, copy) => {
    expect(scanGeneratedCopyCompliance(copy).violations.map((row) => row.id)).toContain(rule);
  });

  it('keeps arbitrary text out of the provider delivery payload', () => {
    const source = read('server/src/services/vmProviders/types.ts');
    const payload = source.match(/export interface VoicemailDropPayload \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(payload).not.toBe('');
    expect(payload).toContain('tokenUrl: string');
    expect(payload).toContain('audioUrl: string | null');
    expect(payload).not.toMatch(/\b(message|copy|script|transcript|subject|body)\s*:/i);
  });

  it('keeps live delivery behind human approval, the global lock, and do-not-drop refusal', () => {
    const source = read('server/src/workers/vmDeliveryWorker.ts');
    expect(source).toContain('isDoNotDropLead(lead)');
    expect(source).toContain('env.VM_LIVE_DELIVERY_ENABLED');
    expect(source).toContain('adminApprovedForLiveDelivery');
    expect(source).toContain("provider.key === 'manual_csv'");
    expect(source).toContain('audioUrl: campaign?.audioUrl ?? null');
  });

  it('keeps manual export free of an unreviewed message or script column', () => {
    const csv = buildManualCsv([
      { leadId: 'lead_1', normalizedPhone: '+13235550123', firstName: 'Pat', lastName: 'R', token: 'TOKEN123', ownerTmagId: 'TMBA-1' },
    ], 'https://teammagnificent.com');
    const header = csv.split('\n')[0] ?? '';
    expect(header).toBe('leadId,phone,firstName,lastName,rvmLink,ownerTmagId');
    expect(header).not.toMatch(/message|copy|script|transcript/i);
  });

  it('records the audio-transcript boundary instead of claiming opaque audio was scanned', () => {
    const checklist = read('docs/VM_RVM_COMPLIANCE_CHECKLIST.md');
    expect(checklist).toContain('Automated copy coverage (P1-79)');
    expect(checklist).toContain('Audio content is opaque to the current runtime');
    expect(checklist).toContain('must not be represented as compliance-scanned');
  });
});


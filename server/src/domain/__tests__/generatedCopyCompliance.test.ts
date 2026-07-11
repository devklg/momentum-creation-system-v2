import { describe, expect, it } from 'vitest';
import { scanGeneratedCopyCompliance } from '../generatedCopyCompliance.js';

function ids(text: string | readonly string[]): string[] {
  return scanGeneratedCopyCompliance(text).violations.map((v) => v.id);
}

describe('generated copy compliance scanner', () => {
  it('allows product naming without treating GLP-THREE as company branding', () => {
    const scan = scanGeneratedCopyCompliance(
      'Hey Dana, I came across GLP-THREE and thought of you. Want to watch a short video?',
    );

    expect(scan.ok).toBe(true);
  });

  it('blocks income, comp-plan, placement, AI qualification, THREE handoff, medical, pressure, and automation language', () => {
    expect(ids('This can help you make money and build income.')).toContain('income');
    expect(ids('The compensation plan pays commissions on CV cycles.')).toContain('comp_plan');
    expect(ids('Your queue position guarantees a spillover placement.')).toContain('placement');
    expect(ids('The AI qualified this prospect with a lead score.')).toContain('ai_qualification');
    expect(ids('The app will enroll you with THREE International.')).toContain('three_handoff');
    expect(ids('You will lose 20 pounds and cure the problem.')).toContain('medical');
    expect(ids('Act now, only 3 spots left.')).toContain('pressure');
    expect(ids('The system will call and follow up for you.')).toContain('automation');
  });

  it('scans grouped generated fields as one compliance boundary', () => {
    const scan = scanGeneratedCopyCompliance([
      'Warm coaching frame.',
      'Ask who might want a guaranteed spot.',
    ]);

    expect(scan.ok).toBe(false);
    expect(scan.violations.map((v) => v.id)).toEqual(['placement']);
  });
});

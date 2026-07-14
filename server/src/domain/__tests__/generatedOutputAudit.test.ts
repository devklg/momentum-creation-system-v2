import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ appendAuditEntry: vi.fn() }));

vi.mock('../auditLog.js', () => ({ appendAuditEntry: mocks.appendAuditEntry }));

beforeEach(() => {
  mocks.appendAuditEntry.mockReset();
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit-1' });
});

describe('P2-124 generated-output audit records', () => {
  it('derives prompt version, records the user and safe input metadata, and omits content', async () => {
    const { appendGeneratedOutputAudit } = await import('../generatedOutputAudit.js');

    await appendGeneratedOutputAudit({
      templateId: 'ivory_personal_invitation',
      tmagId: 'TMAG-1',
      input: {
        classification: 'ivory_personal_invitation',
        ivoryRecordProvided: true,
        relationshipReasonProvided: true,
        relationshipReasonLength: 41,
        productNameProvided: true,
      },
      output: 'Hey Dana! I thought of you. Can I send you a short video?',
      degraded: false,
    });

    const call = mocks.appendAuditEntry.mock.calls[0]![0];
    expect(call).toMatchObject({
      action: 'prompt.output.generated',
      actor: { kind: 'ba', tmagId: 'TMAG-1' },
      entity: {
        kind: 'compliance_rule',
        id: 'ivory_personal_invitation@1.0.0',
      },
      severity: 'info',
      after: {
        prompt: { templateId: 'ivory_personal_invitation', version: '1.0.0' },
        input: {
          classification: 'ivory_personal_invitation',
          relationshipReasonLength: 41,
          privacy: 'metadata_only',
          rawInputStored: false,
        },
        user: { tmagId: 'TMAG-1' },
        output: { source: 'provider', contentStored: false },
        compliance: { scanner: 'generated_copy_compliance_v1', ok: true, violationIds: [] },
      },
    });
    expect(JSON.stringify(call)).not.toContain('Hey Dana');
  });

  it('identifies deterministic fallback output without changing prompt identity', async () => {
    const { appendGeneratedOutputAudit } = await import('../generatedOutputAudit.js');

    await appendGeneratedOutputAudit({
      templateId: 'ivory_wdyk_coach',
      tmagId: 'TMAG-2',
      input: {
        classification: 'ivory_wdyk_coach',
        angle: 'unspecified',
        rosterSize: 0,
        productNameProvided: false,
        askProvided: false,
        askLength: 0,
      },
      output: ['Let your memory wander.', 'Who from a past job comes to mind?'],
      degraded: true,
    });

    expect(mocks.appendAuditEntry.mock.calls[0]![0]).toMatchObject({
      after: { prompt: { version: '1.0.0' }, output: { source: 'deterministic_fallback' } },
    });
  });

  it('normalizes enum metadata at runtime so crafted input cannot become stored text', async () => {
    const { appendGeneratedOutputAudit } = await import('../generatedOutputAudit.js');

    await appendGeneratedOutputAudit({
      templateId: 'ivory_wdyk_coach',
      tmagId: 'TMAG-2',
      input: {
        classification: 'ivory_wdyk_coach',
        angle: 'private relationship note' as never,
        rosterSize: Number.NaN,
        productNameProvided: false,
        askProvided: true,
        askLength: -20,
      },
      output: 'Who from a past chapter comes to mind?',
      degraded: false,
    });

    expect(mocks.appendAuditEntry.mock.calls[0]![0]).toMatchObject({
      after: { input: { angle: 'unspecified', rosterSize: 0, askLength: 0 } },
    });
    expect(JSON.stringify(mocks.appendAuditEntry.mock.calls[0]![0])).not.toContain(
      'private relationship note',
    );
  });

  it('persists a critical rejection and fails closed when delivered output is noncompliant', async () => {
    const { appendGeneratedOutputAudit, GeneratedOutputComplianceAuditError } =
      await import('../generatedOutputAudit.js');

    await expect(
      appendGeneratedOutputAudit({
        templateId: 'scriptmaker_product_invitation',
        tmagId: 'TMAG-3',
        input: {
          classification: 'scriptmaker_product_invitation',
          scriptKind: 'product_anchored',
          productNameLength: 9,
          videoTitleLength: 14,
          prospectFirstNameLength: 4,
          prospectContextProvided: false,
          prospectContextLength: 0,
          eventDayProvided: false,
          eventTimeProvided: false,
        },
        output: 'Act now and make $500 with guaranteed placement.',
        degraded: false,
      }),
    ).rejects.toBeInstanceOf(GeneratedOutputComplianceAuditError);

    expect(mocks.appendAuditEntry.mock.calls[0]![0]).toMatchObject({
      action: 'prompt.output.rejected',
      severity: 'critical',
      after: { compliance: { ok: false, violationIds: expect.arrayContaining(['income', 'placement', 'pressure']) } },
    });
  });
});

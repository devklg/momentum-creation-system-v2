import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');
const ivoryRoutes = readFileSync(path.join(repoRoot, 'server/src/routes/ivory.ts'), 'utf8');
const scriptMakerRoutes = readFileSync(path.join(repoRoot, 'server/src/routes/scriptmaker.ts'), 'utf8');
const steveRuntime = readFileSync(
  path.join(repoRoot, 'server/src/domain/steveConversationRuntime.ts'),
  'utf8',
);

describe('P2-125 LLM provider observability wiring', () => {
  it('reports every Ivory and ScriptMaker deterministic fallback by governed template id', () => {
    expect(ivoryRoutes.match(/recordLlmProviderDegradation\(/g)).toHaveLength(3);
    expect(scriptMakerRoutes.match(/recordLlmProviderDegradation\(/g)).toHaveLength(1);
    for (const templateId of [
      'ivory_wdyk_coach',
      'ivory_personal_invitation',
      'ivory_momentum_followup',
    ]) {
      expect(ivoryRoutes).toContain(`recordLlmProviderDegradation('${templateId}')`);
    }
    expect(scriptMakerRoutes).toContain(
      "recordLlmProviderDegradation('scriptmaker_product_invitation')",
    );
  });

  it('keeps Steve fail-closed without inventing a deterministic provider fallback', () => {
    expect(steveRuntime).not.toContain('recordLlmProviderDegradation');
    expect(steveRuntime).not.toMatch(/degraded:\s*true/);
  });
});

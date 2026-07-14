import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');
const ivoryRoutes = readFileSync(path.join(repoRoot, 'server/src/routes/ivory.ts'), 'utf8');
const scriptMakerRoutes = readFileSync(path.join(repoRoot, 'server/src/routes/scriptmaker.ts'), 'utf8');

describe('P2-124 generated-output route wiring', () => {
  it('audits all three Ivory generation routes with governed template ids', () => {
    expect(ivoryRoutes.match(/appendGeneratedOutputAudit\(\{/g)).toHaveLength(3);
    for (const templateId of [
      'ivory_wdyk_coach',
      'ivory_personal_invitation',
      'ivory_momentum_followup',
    ]) {
      expect(ivoryRoutes).toContain(`templateId: '${templateId}'`);
    }
  });

  it('audits the ScriptMaker generation route without persisting raw input or output', () => {
    expect(scriptMakerRoutes.match(/appendGeneratedOutputAudit\(\{/g)).toHaveLength(1);
    expect(scriptMakerRoutes).toContain("templateId: 'scriptmaker_product_invitation'");
    expect(scriptMakerRoutes).not.toContain('rawInputStored: true');
    expect(scriptMakerRoutes).not.toContain('contentStored: true');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '..');
describe('P1-92 schema drift CI gate', () => {
  it('runs every schema mirror check in dependency order from CI', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const command = pkg.scripts['catalog:schema-drift:check'] ?? '';
    const expected = ['catalog:schema:check','catalog:mongo-ownership:check','catalog:mongo-indexes:check','catalog:neo4j:check','catalog:chroma:check'];
    expect(expected.every((name) => command.includes(name))).toBe(true);
    expected.forEach((name, index) => expect(command.indexOf(name)).toBeGreaterThan(index === 0 ? -1 : command.indexOf(expected[index - 1]!)));
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow.match(/pnpm catalog:schema-drift:check/g)).toHaveLength(1);
  });
});

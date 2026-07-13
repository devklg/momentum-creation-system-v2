import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '..');
describe('P1-92 schema drift CI gate', () => {
  it('regenerates every derived catalog in dependency order before CI validation', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const command = pkg.scripts['catalog:generate:all'] ?? '';
    const expected = [
      'catalog:schema',
      'catalog:mongo-ownership',
      'catalog:mongo-indexes',
      'catalog:neo4j',
      'catalog:chroma',
      'catalog:persistence',
      'catalog:api-routes',
      'catalog:route-access',
      'registry:build',
      'docs:maps',
      'compliance:com',
      'docs:freshness',
    ];
    expect(expected.every((name) => command.includes(name))).toBe(true);
    expected.forEach((name, index) => expect(command.indexOf(name)).toBeGreaterThan(index === 0 ? -1 : command.indexOf(expected[index - 1]!)));
  });

  it('validates generated catalogs on pull requests and refreshes them after merges', () => {
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow.match(/pnpm catalog:generate:all/g)).toHaveLength(2);
    expect(workflow).toContain('refresh-generated-catalogs:');
    expect(workflow).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('needs: gates');
    expect(workflow).toContain('git add -u');
    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('actions: write');
    expect(workflow).toContain('statuses: write');
    expect(workflow).toContain('gh pr create');
    expect(workflow).toContain('gh pr merge "$pr_url" --auto --merge --delete-branch');
    expect(workflow).toContain('gh workflow run ci.yml --ref "$refresh_branch"');
    expect(workflow).toContain('gh run watch "$run_id" --exit-status');
    expect(workflow).toContain('CI Merge Gates passed via workflow_dispatch');
    expect(workflow).not.toContain('git push origin HEAD:main');
    expect(workflow).not.toContain('run: pnpm catalog:schema-drift:check');
  });
});

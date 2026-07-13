import { readFileSync } from 'node:fs'; import path from 'node:path'; import { describe,expect,it } from 'vitest';
import { MCS_LAUNCH_CENTER_CATALOG as catalog } from '@momentum/shared';
const root=path.resolve(process.cwd(),'..');
describe('P2-95 Launch Center route/data catalog',()=>{
 it('anchors one named cockpit surface without a duplicate route',()=>{
  expect(catalog).toMatchObject({teamRoute:'/cockpit',apiRoute:'/api/cockpit/launch',access:'ba_authenticated_pre_steve'});
  const app=readFileSync(path.join(root,'apps/team/src/App.tsx'),'utf8'); expect(app).not.toContain('path="/launch-center"');
  const route=readFileSync(path.join(root,'server/src/routes/cockpit.ts'),'utf8');
  const block=route.slice(route.indexOf("cockpitRoutes.get('/launch'"),route.indexOf("cockpitRoutes.get('/invites'"));
  expect(block).toContain('requireAuth'); expect(block).not.toContain('requireSteveComplete'); expect(block).toContain('req.session?.tmagId');
  expect(catalog.prohibited).toEqual(expect.arrayContaining(['person_score','person_rank','outcome_prediction']));
 });
});
describe('P2-96 conditional boundary',()=>{
 it('keeps the umbrella branch explicitly not applicable',()=>{
  const boundary=readFileSync(path.join(root,'docs/launch-center-product-boundary.md'),'utf8');
  const tasks=readFileSync(path.join(root,'PLATFORM_AUDIT_PRIORITY_TASKLIST.md'),'utf8');
  expect(catalog.productBoundary).toBe('named_first_run_surface_within_cockpit');
  expect(boundary).toContain('not renamed or subsumed');
  expect(tasks).toMatch(/\[x\] 96[\s\S]*Not applicable/);
 });
});

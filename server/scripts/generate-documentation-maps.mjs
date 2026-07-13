#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const check=process.argv.includes('--check');
for(const script of ['generate-api-route-map.mjs','generate-route-access-matrix.mjs','generate-schema-catalog.mjs','generate-persistence-write-catalog.mjs']){
 const r=spawnSync(process.execPath,[path.join(root,'server/scripts',script),...(check?['--check']:[])],{cwd:root,stdio:'inherit'}); if(r.status!==0) process.exit(r.status??1);
}
const content=`# Generated Platform Maps\n\nThese files are generated, reviewable mirrors. Run \`pnpm docs:maps\` after changing routes, access controls, schemas, or persistence writes; CI runs \`pnpm docs:maps:check\`.\n\n| Map | Markdown | Machine-readable |\n| --- | --- | --- |\n| API routes | [API route map](../engineering/sprints/platform-audit-p1/API_ROUTE_MAP.md) | [JSON](../engineering/sprints/platform-audit-p1/api-route-map.json) |\n| Route access | [Route access matrix](../engineering/sprints/platform-audit-p1/ROUTE_ACCESS_MATRIX.md) | [JSON](../engineering/sprints/platform-audit-p1/route-access-matrix.json) |\n| Schema | [Schema catalog](../engineering/sprints/platform-audit-p1/SCHEMA_CATALOG.md) | [JSON](../engineering/sprints/platform-audit-p1/schema-catalog.json) |\n| Persistence | [Persistence write catalog](../engineering/sprints/platform-audit-p1/PERSISTENCE_WRITE_CATALOG.md) | [JSON](../engineering/sprints/platform-audit-p1/persistence-write-catalog.json) |\n`;
const out=path.join(root,'docs/generated-platform-maps.md');
if(check){if(readFileSync(out,'utf8')!==content) throw new Error('Generated platform map index is stale. Run pnpm docs:maps');}
else writeFileSync(out,content);

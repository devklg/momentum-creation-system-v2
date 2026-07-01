// One-shot codemod: prefix every exported @momentum/shared symbol per the
// one-name convention, scope-aware via ts-morph (so strings/comments/common
// words like `colors`/`fonts`/`TeamId` are NOT touched — only real references).
//   PascalCase type/interface/enum → Mcs<Name>
//   SCREAMING_SNAKE const          → MCS_<NAME>
//   lowerCamel const               → mcs<Name>
//   already Mcs/Tmag prefixed      → skipped (member-identity Tmag* preserved)
import { Project, ts } from 'ts-morph';

const project = new Project({
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@momentum/shared': ['packages/shared/src/index.ts'],
      '@momentum/shared/*': ['packages/shared/src/*'],
    },
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    strict: false,
    esModuleInterop: true,
    allowJs: false,
  },
});

project.addSourceFilesAtPaths([
  'packages/shared/src/**/*.ts',
  'server/src/**/*.ts',
  'apps/com/src/**/*.{ts,tsx}',
  'apps/team/src/**/*.{ts,tsx}',
  'apps/admin/src/**/*.{ts,tsx}',
]);
console.log(`loaded ${project.getSourceFiles().length} source files`);

function newName(name) {
  if (/^(Mcs|Tmag)/.test(name)) return null;      // already prefixed
  if (/^[A-Z0-9_]+$/.test(name)) return 'MCS_' + name;                 // SCREAMING const
  if (/^[a-z]/.test(name)) return 'mcs' + name[0].toUpperCase() + name.slice(1); // lower const
  return 'Mcs' + name;                                                  // PascalCase type
}

const sharedFiles = project
  .getSourceFiles()
  .filter((f) => f.getFilePath().replace(/\\/g, '/').includes('/packages/shared/src/'));

const targets = [];
for (const f of sharedFiles) {
  const named = [
    ...f.getTypeAliases().filter((d) => d.isExported()),
    ...f.getInterfaces().filter((d) => d.isExported()),
    ...f.getEnums().filter((d) => d.isExported()),
    ...f.getVariableDeclarations().filter((v) => v.getVariableStatement()?.isExported()),
  ];
  for (const d of named) {
    const name = d.getName();
    const nn = newName(name);
    if (nn) targets.push({ node: d, name, nn });
  }
}
console.log(`found ${targets.length} exported symbols to rename`);

let done = 0;
const failed = [];
for (const t of targets) {
  try {
    t.node.rename(t.nn);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${targets.length}`);
  } catch (e) {
    failed.push(`${t.name} → ${t.nn}: ${e.message}`);
  }
}
console.log(`renamed ${done}/${targets.length}; failed ${failed.length}`);
for (const f of failed.slice(0, 20)) console.log('  FAIL ' + f);
console.log('saving...');
await project.save();
console.log('done.');

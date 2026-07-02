// Generates the FULL data dictionary — every exported model/interface (all
// fields), every enum/union (all values), every type alias — straight from the
// @momentum/shared TypeScript source, so it can never drift from the code.
// Output: engineering/reports/MCS_V2_SCHEMA_REFERENCE.docx
import { Project } from 'ts-morph';
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType,
} from 'docx';
import { writeFileSync } from 'node:fs';

const INK = '14161C', BLUE = '3B82F6', PURPLE = '8A2BE2', GREEN = '15803D', LINE = 'E4E7EE', SOFT = 'F6F7FB';
const FONT = 'Calibri', MONO = 'Consolas';
const clip = (s, n = 160) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

const project = new Project({
  compilerOptions: { baseUrl: '.', paths: { '@momentum/shared': ['packages/shared/src/index.ts'], '@momentum/shared/*': ['packages/shared/src/*'] }, skipLibCheck: true },
});
project.addSourceFilesAtPaths('packages/shared/src/**/*.ts');
const files = project.getSourceFiles()
  .filter((f) => !f.getFilePath().includes('__tests__'))
  .sort((a, b) => a.getBaseName().localeCompare(b.getBaseName()));

// ── docx helpers ──
const run = (t, o = {}) => new TextRun({ text: t, font: o.mono ? MONO : FONT, bold: o.b, italics: o.i, color: o.color, size: o.size || 18 });
const cell = (runs, { w, head } = {}) => new TableCell({
  width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
  shading: head ? { type: ShadingType.SOLID, color: INK } : undefined,
  margins: { top: 30, bottom: 30, left: 70, right: 70 },
  children: [new Paragraph({ spacing: { after: 0 }, children: Array.isArray(runs) ? runs : [runs] })],
});
const border = { style: BorderStyle.SINGLE, size: 2, color: LINE };
function fieldTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell(run('Field', { b: true, color: 'FFFFFF', size: 16 }), { w: 30, head: true }),
        cell(run('Type', { b: true, color: 'FFFFFF', size: 16 }), { w: 58, head: true }),
        cell(run('Req', { b: true, color: 'FFFFFF', size: 16 }), { w: 12, head: true }),
      ] }),
      ...rows.map((r) => new TableRow({ children: [
        cell(run(r.name, { mono: true, size: 16 }), { w: 30 }),
        cell(run(clip(r.type), { mono: true, size: 15, color: '3B3F46' }), { w: 58 }),
        cell(run(r.req ? 'yes' : '—', { size: 15, color: r.req ? GREEN : '9AA0AA' }), { w: 12 }),
      ] })),
    ],
  });
}

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run('MOMENTUM CREATION SYSTEM V2', { b: true, size: 22, color: PURPLE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run('Schema Reference — Full Data Dictionary', { b: true, size: 38, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run('Every exported model, interface, enum, and type in @momentum/shared — generated from source (canonical tmag_/Mcs names). Companion to MCS_V2_DB_ERD.pdf.', { i: true, size: 16, color: '5B616E' })] }),
];

let nInterfaces = 0, nTypes = 0, nEnums = 0;
for (const f of files) {
  const interfaces = f.getInterfaces().filter((d) => d.isExported());
  const aliases = f.getTypeAliases().filter((d) => d.isExported());
  const enums = f.getEnums().filter((d) => d.isExported());
  if (!interfaces.length && !aliases.length && !enums.length) continue;

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 80 },
    children: [run(f.getBaseName(), { b: true, size: 26, color: INK })] }));

  for (const i of interfaces) {
    nInterfaces++;
    children.push(new Paragraph({ spacing: { before: 140, after: 40 }, children: [run(i.getName(), { b: true, size: 20, color: BLUE })] }));
    const rows = i.getProperties().map((p) => ({
      name: p.getName(),
      type: (p.getTypeNode()?.getText() ?? p.getType().getText()).replace(/\s+/g, ' '),
      req: !p.hasQuestionToken(),
    }));
    children.push(rows.length ? fieldTable(rows) : new Paragraph({ children: [run('(no properties)', { i: true, size: 15 })] }));
  }

  // type aliases + enums (values / definitions) as a compact 2-col table
  const defs = [];
  for (const a of aliases) { nTypes++; defs.push({ name: a.getName(), def: (a.getTypeNode()?.getText() ?? '').replace(/\s+/g, ' ') }); }
  for (const e of enums) { nEnums++; defs.push({ name: e.getName() + ' (enum)', def: e.getMembers().map((m) => m.getName()).join(' · ') }); }
  if (defs.length) {
    children.push(new Paragraph({ spacing: { before: 140, after: 40 }, children: [run('Types & enums', { b: true, size: 18, color: GREEN })] }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
      rows: [
        new TableRow({ tableHeader: true, children: [cell(run('Type', { b: true, color: 'FFFFFF', size: 16 }), { w: 32, head: true }), cell(run('Definition / values', { b: true, color: 'FFFFFF', size: 16 }), { w: 68, head: true })] }),
        ...defs.map((d) => new TableRow({ children: [cell(run(d.name, { mono: true, size: 16 }), { w: 32 }), cell(run(clip(d.def, 240), { mono: true, size: 15, color: '3B3F46' }), { w: 68 })] })),
      ],
    }));
  }
}

children.splice(3, 0, new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER,
  children: [run(`${nInterfaces} interfaces · ${nTypes} type aliases · ${nEnums} enums across ${files.length} modules`, { b: true, size: 18, color: GREEN })] }));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 18 } } } },
  sections: [{ properties: { page: { margin: { top: 620, bottom: 620, left: 620, right: 620 } } }, children }],
});
const out = 'engineering/reports/MCS_V2_SCHEMA_REFERENCE.docx';
const buf = await Packer.toBuffer(doc);
writeFileSync(out, buf);
console.log(`wrote ${out} — ${nInterfaces} interfaces, ${nTypes} types, ${nEnums} enums; ${(buf.length / 1024).toFixed(0)} KB`);

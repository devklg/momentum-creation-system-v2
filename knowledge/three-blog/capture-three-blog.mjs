// THREE blog capture + provenance pipeline. Fetches public articles, writes markdown snapshots,
// computes SHA-256, appends manifest rows. Node-native fetch (Node 18+). No auth, public blog only.
import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SLUGS_FILE = process.argv[2]; // JSON file of slugs
const ROOT = 'D:/momentum-creation-system-v2/knowledge/three-blog';
const SNAP = path.join(ROOT, 'extracted');
const MANIFEST = path.join(ROOT, 'PROVENANCE_MANIFEST.md');
const BASE = 'https://blog.threeinternational.com/en/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractArticle(html) {
  // crude but effective: title from <h1> or og:title; body from <article>/<main>; strip tags
  const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = (ogTitle || (h1 ? h1.replace(/<[^>]+>/g, '') : '') || '').trim();
  let body = (html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i) || [''])[0];
  if (!body) body = html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  // block elements -> newlines
  body = body.replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n').replace(/<li[^>]*>/gi, '- ');
  const text = body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, '\u2014')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text };
}

const report = { captured: 0, failed: 0, rows: [] };

function urlFor(slug) {
  return /^https?:\/\//i.test(slug) ? slug : BASE + slug.replace(/^\/+/, '');
}

function snapshotNameFor(slugOrUrl) {
  const slug = /^https?:\/\//i.test(slugOrUrl)
    ? new URL(slugOrUrl).pathname.replace(/^\/en\/?/, '')
    : slugOrUrl;
  return slug.replace(/^\/+/, '').replace(/[\\/:*?"<>|]/g, '__') + '.md';
}

async function main() {
  await mkdir(SNAP, { recursive: true });
  const slugs = JSON.parse(await (await import('node:fs/promises')).readFile(SLUGS_FILE, 'utf8'));
  for (const slug of slugs) {
    const url = urlFor(slug);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const { title, text } = extractArticle(html);
      if (text.length < 200) throw new Error('thin extract ' + text.length);
      const md = `# ${title}\n\nSource: ${url}\nCaptured: ${new Date().toISOString()}\nAuthority: THREE-corporate (public blog)\n\n---\n\n${text}\n`;
      const snapshotName = snapshotNameFor(slug);
      const snapPath = path.join(SNAP, snapshotName);
      await writeFile(snapPath, md, 'utf8');
      const sha = createHash('sha256').update(md).digest('hex').slice(0, 16);
      report.rows.push(`| ${slug} | ${url} | extracted/${snapshotName} | ${sha} | ${new Date().toISOString().slice(0,10)} | ${text.length} | (pending) | CAPTURED |`);
      report.captured++;
      console.log(`OK ${slug} chars=${text.length} sha=${sha}`);
    } catch (e) {
      report.rows.push(`| ${slug} | ${url} | — | — | ${new Date().toISOString().slice(0,10)} | 0 | — | FAILED: ${e.message} |`);
      report.failed++;
      console.log(`FAIL ${slug}: ${e.message}`);
    }
    await sleep(400); // rate-limit, be polite
  }
  await appendFile(MANIFEST, report.rows.join('\n') + '\n', 'utf8');
  console.log(`CAPTURE COMPLETE captured=${report.captured} failed=${report.failed}`);
}
main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });

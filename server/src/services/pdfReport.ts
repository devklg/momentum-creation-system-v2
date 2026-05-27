/**
 * Shared PDF report foundation (Chat #142).
 *
 * A thin, dependency-light wrapper over pdfkit that every Team Magnificent
 * printable report builds on, so the brand header, the verifiability footer
 * (generation timestamp + source-data hash), and the table/section helpers
 * are written once and reused. Two consumers today:
 *   - domain/cockpitPrint.ts        BA prospect-list print
 *   - domain/adminMasterReport.ts   ADMIN I.3 master report
 *
 * Brand tokens are the locked five-color palette + type stack (locked-spec
 * 3.15). pdfkit ships Helvetica only; Bebas Neue / DM Sans / DM Mono are not
 * embedded here (font-file embedding is a follow-on if Kevin wants exact
 * brand type in print). Helvetica-Bold stands in for the display face and is
 * called out as a known gap, not silently passed off as the brand font.
 *
 * I.3 verifiability (ADMIN Design I.3): every report carries a generation
 * timestamp and a SHA-256 hash of the source data it was built from, so a
 * filed/shared snapshot can be checked against the live data later. The hash
 * is computed by the caller over the exact records rendered and handed in.
 *
 * pdfkit streams to a Writable; callers pipe to an Express response or a
 * buffer. buildPdfToBuffer() collects the whole document into a Buffer for
 * the route layer to set Content-Length and send in one shot.
 */

import PDFDocument from 'pdfkit';
import { createHash } from 'node:crypto';

/** Locked five-color palette (locked-spec 3.15). */
export const BRAND = {
  ink: '#0A0A0A',
  gold: '#C9A84C',
  goldBright: '#F5C030',
  teal: '#2DD4BF',
  cream: '#F5EFE6',
  // Derived neutrals for print legibility (not new brand colors — greys for
  // table rules and secondary text on white paper).
  rule: '#D8D2C4',
  subtext: '#5A5750',
} as const;

const PAGE_MARGIN = 54; // 0.75in
const DISPLAY_FONT = 'Helvetica-Bold'; // stand-in for Bebas Neue (see header note)
const BODY_FONT = 'Helvetica';
const MONO_FONT = 'Courier'; // stand-in for DM Mono (hash/id rendering)

export interface ReportMeta {
  /** Big display title, e.g. "MASTER REPORT" or "MY PROSPECTS". */
  title: string;
  /** One-line subtitle, e.g. "Team Magnificent · All BAs · Lifetime". */
  subtitle: string;
  /**
   * The exact source records this report rendered. Hashed (SHA-256) for the
   * verifiability footer. Pass the same array you rendered so the hash
   * actually corresponds to the printed content.
   */
  sourceData: unknown;
  /**
   * Optional provenance line shown under the title. Used by I.3 to state
   * honestly what it currently composites (so today's partial master report
   * can never be mistaken for the full I.1 library composite).
   */
  provenanceNote?: string;
}

/** Stable JSON stringify (sorted keys) so the hash is deterministic. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

export function hashSourceData(sourceData: unknown): string {
  return createHash('sha256').update(stableStringify(sourceData)).digest('hex');
}

export interface TableColumn<Row> {
  header: string;
  /** Column width in points. Columns should sum to ~ printable width (487). */
  width: number;
  /** Cell renderer — return the display string for this row. */
  value: (row: Row) => string;
  align?: 'left' | 'right' | 'center';
}

/**
 * A PDF builder bound to one document. Construct via the constructor; call
 * the section/table helpers; finish with end(). The header is drawn
 * immediately; the footer (timestamp + hash) is stamped on every page at
 * end().
 */
export class PdfReport {
  readonly doc: PDFKit.PDFDocument;
  private readonly generatedAt: string;
  private readonly sourceHash: string;
  private readonly printableWidth: number;

  constructor(private readonly meta: ReportMeta) {
    this.doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + 28, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true, // so we can stamp the footer on every page at the end
    });
    this.generatedAt = new Date().toISOString();
    this.sourceHash = hashSourceData(meta.sourceData);
    this.printableWidth =
      this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
    this.drawHeader();
  }

  /** Brand-locked header band: ink bar, gold wordmark, title, subtitle. */
  private drawHeader(): void {
    const { doc } = this;
    const left = doc.page.margins.left;
    const top = 28;

    doc.save();
    doc.rect(0, 0, doc.page.width, 84).fill(BRAND.ink);
    doc
      .fillColor(BRAND.gold)
      .font(DISPLAY_FONT)
      .fontSize(20)
      .text('TEAM MAGNIFICENT', left, top, { characterSpacing: 1.5 });
    doc
      .fillColor(BRAND.cream)
      .font(DISPLAY_FONT)
      .fontSize(20)
      .text(this.meta.title.toUpperCase(), left, top, {
        width: this.printableWidth,
        align: 'right',
        characterSpacing: 1,
      });
    doc.restore();

    doc
      .fillColor(BRAND.subtext)
      .font(BODY_FONT)
      .fontSize(10)
      .text(this.meta.subtitle, left, 96, { width: this.printableWidth });

    let y = 112;
    if (this.meta.provenanceNote) {
      doc
        .fillColor('#8A6D1F')
        .font(BODY_FONT)
        .fontSize(8.5)
        .text(this.meta.provenanceNote, left, y, { width: this.printableWidth });
      y = doc.y + 4;
    }
    doc
      .moveTo(left, y + 4)
      .lineTo(left + this.printableWidth, y + 4)
      .lineWidth(1.5)
      .strokeColor(BRAND.teal)
      .stroke();
    doc.y = y + 16;
    doc.x = left;
  }

  /** Section heading in display type with a thin underline. */
  section(label: string): this {
    const { doc } = this;
    this.ensureSpace(40);
    doc
      .fillColor(BRAND.ink)
      .font(DISPLAY_FONT)
      .fontSize(13)
      .text(label.toUpperCase(), { characterSpacing: 0.8 });
    const y = doc.y + 2;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + this.printableWidth, y)
      .lineWidth(0.75)
      .strokeColor(BRAND.rule)
      .stroke();
    doc.moveDown(0.5);
    doc.x = doc.page.margins.left;
    return this;
  }

  /** A labeled stat line: "Label   value". */
  stat(label: string, value: string): this {
    const { doc } = this;
    this.ensureSpace(18);
    const left = doc.page.margins.left;
    const y = doc.y;
    doc.fillColor(BRAND.subtext).font(BODY_FONT).fontSize(10).text(label, left, y, {
      width: this.printableWidth * 0.6,
      continued: false,
    });
    doc
      .fillColor(BRAND.ink)
      .font(DISPLAY_FONT)
      .fontSize(11)
      .text(value, left + this.printableWidth * 0.6, y, {
        width: this.printableWidth * 0.4,
        align: 'right',
      });
    doc.moveDown(0.35);
    doc.x = left;
    return this;
  }

  paragraph(text: string, opts?: { color?: string; size?: number }): this {
    const { doc } = this;
    this.ensureSpace(16);
    doc
      .fillColor(opts?.color ?? BRAND.subtext)
      .font(BODY_FONT)
      .fontSize(opts?.size ?? 9.5)
      .text(text, { width: this.printableWidth });
    doc.moveDown(0.4);
    doc.x = doc.page.margins.left;
    return this;
  }

  /** Render a table with an ink header row and alternating row tint. */
  table<Row>(columns: TableColumn<Row>[], rows: Row[], emptyText = 'No records.'): this {
    const { doc } = this;
    const left = doc.page.margins.left;
    const rowHeight = 18;

    const drawHeaderRow = () => {
      const y = doc.y;
      doc.save();
      doc.rect(left, y, this.printableWidth, rowHeight).fill(BRAND.ink);
      let x = left + 4;
      for (const col of columns) {
        doc
          .fillColor(BRAND.gold)
          .font(DISPLAY_FONT)
          .fontSize(8.5)
          .text(col.header.toUpperCase(), x, y + 5, {
            width: col.width - 8,
            align: col.align ?? 'left',
            characterSpacing: 0.5,
            lineBreak: false,
          });
        x += col.width;
      }
      doc.restore();
      doc.y = y + rowHeight;
    };

    this.ensureSpace(rowHeight * 2);
    drawHeaderRow();

    if (rows.length === 0) {
      doc.fillColor(BRAND.subtext).font(BODY_FONT).fontSize(9.5).text(emptyText, left + 4, doc.y + 5);
      doc.moveDown(1);
      doc.x = left;
      return this;
    }

    rows.forEach((row, i) => {
      if (this.remainingSpace() < rowHeight + 4) {
        doc.addPage();
        drawHeaderRow();
      }
      const y = doc.y;
      if (i % 2 === 1) {
        doc.save();
        doc.rect(left, y, this.printableWidth, rowHeight).fill(BRAND.cream);
        doc.restore();
      }
      let x = left + 4;
      for (const col of columns) {
        doc
          .fillColor(BRAND.ink)
          .font(BODY_FONT)
          .fontSize(9)
          .text(col.value(row), x, y + 5, {
            width: col.width - 8,
            align: col.align ?? 'left',
            lineBreak: false,
            ellipsis: true,
          });
        x += col.width;
      }
      doc.y = y + rowHeight;
    });

    doc
      .moveTo(left, doc.y)
      .lineTo(left + this.printableWidth, doc.y)
      .lineWidth(0.75)
      .strokeColor(BRAND.rule)
      .stroke();
    doc.moveDown(0.6);
    doc.x = left;
    return this;
  }

  private remainingSpace(): number {
    return this.doc.page.height - this.doc.page.margins.bottom - this.doc.y;
  }

  private ensureSpace(needed: number): void {
    if (this.remainingSpace() < needed) {
      this.doc.addPage();
    }
  }

  /**
   * Stamp the verifiability footer on every buffered page and finalize.
   * Footer carries the generation timestamp and the SHA-256 source hash
   * (ADMIN Design I.3), plus page N of M.
   */
  end(): void {
    const { doc } = this;
    const range = doc.bufferedPageRange();
    const left = doc.page.margins.left;
    const printableWidth = this.printableWidth;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footY = doc.page.height - doc.page.margins.bottom + 8;
      doc
        .moveTo(left, footY)
        .lineTo(left + printableWidth, footY)
        .lineWidth(0.5)
        .strokeColor(BRAND.rule)
        .stroke();
      doc
        .fillColor(BRAND.subtext)
        .font(BODY_FONT)
        .fontSize(7.5)
        .text(`Generated ${this.generatedAt}`, left, footY + 4, {
          width: printableWidth * 0.5,
          align: 'left',
          lineBreak: false,
        });
      doc
        .fillColor(BRAND.subtext)
        .font(BODY_FONT)
        .fontSize(7.5)
        .text(`Page ${i - range.start + 1} of ${range.count}`, left, footY + 4, {
          width: printableWidth,
          align: 'right',
          lineBreak: false,
        });
      doc
        .fillColor(BRAND.subtext)
        .font(MONO_FONT)
        .fontSize(7)
        .text(`sha256:${this.sourceHash}`, left, footY + 14, {
          width: printableWidth,
          align: 'left',
          lineBreak: false,
        });
    }
    doc.flushPages();
    doc.end();
  }

  /** Expose the computed hash + timestamp so the route can log them in audit. */
  get verifiability(): { generatedAt: string; sourceHash: string } {
    return { generatedAt: this.generatedAt, sourceHash: this.sourceHash };
  }
}

/**
 * Collect a built report into a single Buffer. The build callback receives
 * the PdfReport, adds content, and need NOT call end() — this helper calls
 * it. Returns the buffer plus the verifiability fields for audit logging.
 */
export async function buildPdfToBuffer(
  meta: ReportMeta,
  build: (report: PdfReport) => void,
): Promise<{ buffer: Buffer; generatedAt: string; sourceHash: string }> {
  const report = new PdfReport(meta);
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    report.doc.on('data', (c: Buffer) => chunks.push(c));
    report.doc.on('end', () =>
      resolve({ buffer: Buffer.concat(chunks), ...report.verifiability }),
    );
    report.doc.on('error', reject);
    try {
      build(report);
      report.end();
    } catch (err) {
      reject(err);
    }
  });
}

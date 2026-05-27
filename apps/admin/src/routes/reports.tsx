/**
 * /reports — Admin reporting page (Chat #144).
 *
 * Minimal scaffold this round (I-export tranche): the page hosts the
 * ExportPanel for the seven I.1 reports. The Section I.1 viewers
 * (JSON tables, charts) land in a later tranche; this page is the
 * landing place for export, and grows downward.
 */

import { ExportPanel } from '@/components/admin/reports/ExportPanel';

export function ReportsPage() {
  return (
    <div className="max-w-5xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section I · Reporting
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Reports</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Standard-report library export. Each report is a CSV with a
        per-file PII-redaction choice. The seven I.1 reports composite
        into the I.3 Master Report PDF separately.
      </p>

      <ExportPanel />
    </div>
  );
}

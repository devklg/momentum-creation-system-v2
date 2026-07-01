/**
 * ExportPanel — entry point for ADMIN I.4/I.5 CSV exports (Chat #144).
 *
 * Renders the seven I.1 reports as a list of Export buttons. Clicking
 * one opens the RedactionModal; the modal returns `redacted | raw` and
 * this panel issues a `GET /api/admin/reporting/<key>/export?redact=…`,
 * triggering a browser download.
 *
 * The panel is filter-aware: it accepts the dashboard's
 * AdminDashboardFilter so a narrowed admin view exports the same scope
 * the user is currently looking at. Time range is fixed to lifetime
 * for this round — the time-range picker will land with I.2.
 *
 * No state is persisted; the modal always asks. Audit logging is the
 * server's responsibility (one entry per export with the redact choice).
 */

import { useState } from 'react';
import type { McsAdminDashboardFilter } from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { RedactionModal, type RedactionChoice } from './RedactionModal';

interface ReportEntry {
  /** URL slug used in the existing reporting routes — keeps the export URL aligned. */
  slug: string;
  /** Display label used in the modal header + the button text. */
  label: string;
  /** One-line description shown next to the button so Kevin knows what's in it. */
  blurb: string;
}

const REPORTS: readonly ReportEntry[] = [
  {
    slug: 'activation',
    label: 'BA Activation',
    blurb: 'Signup → first invite → first enrollment milestones + cohorts.',
  },
  {
    slug: 'training',
    label: 'Training Completion',
    blurb: 'Fast Start modules 1–5 + orientation completion per BA.',
  },
  {
    slug: 'invite-funnel',
    label: 'Invite-to-Presentation Movement',
    blurb: 'Mint → click → video-start → video-complete funnel + per-BA.',
  },
  {
    slug: 'queue-velocity',
    label: 'Queue Velocity',
    blurb: 'Daily placements, flushes, enrollments, net change.',
  },
  {
    slug: 'enrollment-completion',
    label: 'Enrollment Completion',
    blurb: 'Prospects marked enrolled, sliced per BA, per day, per cohort.',
  },
  {
    slug: 'follow-up-aging',
    label: 'Follow-Up Aging',
    blurb: 'Open follow-ups bucketed 0–3 / 4–7 / 8–14 / 15+ days.',
  },
  {
    slug: 'leader-scorecards',
    label: 'Leader Scorecards',
    blurb: 'THREE-qualified leaders with ≥5 personal enrollments (Kevin-only).',
  },
];

export interface ExportPanelProps {
  /**
   * Dashboard filter applied to every export (BA narrowing + leader-group).
   * Defaults to no filter / all BAs when omitted.
   */
  filter?: McsAdminDashboardFilter;
}

export function ExportPanel({ filter }: ExportPanelProps) {
  const [pending, setPending] = useState<ReportEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onChoose(choice: RedactionChoice): void {
    if (!pending) return;
    const entry = pending;
    setPending(null);
    void runExport(entry, choice);
  }

  async function runExport(entry: ReportEntry, choice: RedactionChoice): Promise<void> {
    setBusy(entry.slug);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('format', 'csv');
      params.set('redact', choice === 'redacted' ? 'true' : 'false');
      if (filter?.tmagId) params.set('tmagId', filter.tmagId);
      if (filter?.leaderGroup && filter.leaderGroup !== 'all') {
        params.set('leaderGroup', filter.leaderGroup);
      }

      const url = `/api/admin/reporting/${entry.slug}/export?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        // The server returns JSON on error; pluck the message if we can.
        let msg = `Export failed (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          // Body was not JSON — keep the default message.
        }
        setErr(msg);
        return;
      }

      // Pull the filename from Content-Disposition; fall back to a sensible default.
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] ?? `${entry.slug}.csv`;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section I.4 · Export
      </p>
      <h2 className="font-display text-[28px] leading-none mb-2">CSV Export</h2>
      <p className="text-cream-mute text-sm mb-6 max-w-2xl">
        Every export opens a modal so you choose redacted-or-raw per file.
        The choice is recorded in the audit log alongside the report key
        and row count. Range is lifetime; BA / leader-group narrowing
        follows the current filter.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">
          {err}
        </p>
      )}

      <div className="border border-line rounded-md overflow-hidden">
        {REPORTS.map((entry, i) => (
          <div
            key={entry.slug}
            className={[
              'flex items-center justify-between gap-6 px-5 py-4',
              i > 0 ? 'border-t border-line' : '',
            ].join(' ')}
          >
            <div className="min-w-0">
              <p className="text-sm text-cream font-body">{entry.label}</p>
              <p className="text-[12px] text-cream-mute mt-0.5">{entry.blurb}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPending(entry)}
              disabled={busy !== null}
            >
              {busy === entry.slug ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        ))}
      </div>

      <RedactionModal
        open={pending !== null}
        reportLabel={pending?.label ?? ''}
        onChoose={onChoose}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

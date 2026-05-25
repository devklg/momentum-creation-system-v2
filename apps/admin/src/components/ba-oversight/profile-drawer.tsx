/**
 * C.4 — Brand Ambassador profile drawer.
 *
 * Slide-out drawer from the right of the directory table. Loads the full
 * profile bundle from GET /api/admin/bas/:baId. Sections (top-to-bottom):
 *
 *   1. Identity (name / BA IDs / contact / signed-up / last activity / status)
 *   2. Sponsor (current + override history; link to C.5 override flow)
 *   3. Access code owned
 *   4. Welcome + first login
 *   5. 2-in-72 (current count + 30-day historical not yet wired — display today's number)
 *   6. Invite activity (count + link to that BA's prospect list — link wired-dormant)
 *   7. Training (Fast Start module count + complete badge)
 *   8. Michael interview transcript link
 *   9. Leader tags (system + curated toggle)
 *  10. Notes (Kevin-private, append-only)
 *
 * Override flow is launched from the Sponsor section via the Override
 * button — handled by SponsorOverrideFlow.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type {
  AdminBaDirectoryRow,
  AdminBaNoteEntry,
  AdminBaProfileBundle,
  AdminBaProfileResponse,
  AdminSponsorOverrideEntry,
} from '@momentum/shared';
import { SponsorOverrideFlow } from './sponsor-override-flow';
import { NotesPanel } from './notes-panel';

interface Props {
  baId: string;
  onClose: () => void;
  onRowChanged: (row: AdminBaDirectoryRow) => void;
}

export function ProfileDrawer({ baId, onClose, onRowChanged }: Props) {
  const [bundle, setBundle] = useState<AdminBaProfileBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baId]);

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`/api/admin/bas/${encodeURIComponent(baId)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as AdminBaProfileResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load profile.');
        return;
      }
      setBundle(data.profile);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    }
  }

  function onOverrideApplied(
    nextRow: AdminBaDirectoryRow,
    entry: AdminSponsorOverrideEntry,
  ) {
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            row: nextRow,
            sponsorOverrideHistory: [entry, ...prev.sponsorOverrideHistory],
          }
        : prev,
    );
    setOverrideOpen(false);
    onRowChanged(nextRow);
  }

  function onNoteAppended(note: AdminBaNoteEntry) {
    setBundle((prev) =>
      prev ? { ...prev, notes: [note, ...prev.notes] } : prev,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-ink/70 backdrop-blur-sm"
        aria-label="Close profile drawer"
      />
      <aside className="w-[640px] max-w-[95vw] h-full overflow-y-auto bg-ink border-l border-line">
        <header className="px-6 py-5 border-b border-line flex items-start justify-between sticky top-0 bg-ink z-10">
          <div>
            <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-1">
              Admin · Section C · Profile
            </p>
            <h2 className="font-display text-[24px] leading-tight text-cream">
              {bundle?.row.fullName ?? 'Loading…'}
            </h2>
            {bundle && (
              <p className="text-[11px] font-mono text-cream-mute mt-1">
                {bundle.row.baId} · THREE {bundle.row.threeBaId}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        {err && (
          <p className="px-6 py-4 text-[13px] font-mono tracking-[0.04em] text-red-400">
            {err}
          </p>
        )}

        {bundle && (
          <div className="px-6 py-5 space-y-6">
            <Section title="Identity">
              <KV label="Email">{bundle.row.email ?? '—'}</KV>
              <KV label="Phone">{bundle.row.phone ?? '—'}</KV>
              <KV label="Signed up">{formatDateTime(bundle.row.joinedAt)}</KV>
              <KV label="Last activity">
                {bundle.row.lastActivityAt
                  ? formatDateTime(bundle.row.lastActivityAt)
                  : '—'}
              </KV>
              <KV label="Status">
                <StatusPill status={bundle.row.status} />
              </KV>
            </Section>

            <Section
              title="Sponsor"
              right={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOverrideOpen(true)}
                >
                  Override sponsor
                </Button>
              }
            >
              <KV label="Current">
                {bundle.row.sponsorName ? (
                  <>
                    <span className="text-cream">{bundle.row.sponsorName}</span>{' '}
                    <span className="font-mono text-cream-mute text-[11px]">
                      {bundle.row.sponsorBaId}
                    </span>
                  </>
                ) : (
                  <span className="text-cream-faint">— root —</span>
                )}
              </KV>
              {bundle.row.originalSponsorBaId && (
                <KV label="Original">
                  <span className="text-cream-mute">
                    {bundle.row.originalSponsorName ?? bundle.row.originalSponsorBaId}
                  </span>{' '}
                  <span className="font-mono text-cream-faint text-[11px]">
                    {bundle.row.originalSponsorBaId}
                  </span>
                  <span className="ml-2 text-[10px] font-mono text-gold/70 uppercase tracking-label">
                    historical record
                  </span>
                </KV>
              )}
              {bundle.sponsorOverrideHistory.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase mb-2">
                    Override history
                  </p>
                  <ul className="space-y-2">
                    {bundle.sponsorOverrideHistory.map((o) => (
                      <li
                        key={o.overrideId}
                        className="text-[12px] border border-line rounded p-3 bg-cream/[0.015]"
                      >
                        <p className="font-mono text-cream-mute">
                          {formatDateTime(o.performedAt)} · requested by{' '}
                          <span className="text-cream">{o.requestingBaId}</span>
                        </p>
                        <p className="text-cream-mute mt-1">
                          {o.previousSponsorBaId} →{' '}
                          <span className="text-cream">{o.newSponsorBaId}</span>
                        </p>
                        <p className="text-cream mt-2 whitespace-pre-wrap">{o.reason}</p>
                        <p className="text-[10px] font-mono text-cream-faint mt-2 tracking-label uppercase">
                          audit {o.auditEntryId}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            <Section title="Access code">
              {bundle.row.accessCodeOwned ? (
                <span className="font-mono text-gold text-[15px]">
                  {bundle.row.accessCodeOwned}
                </span>
              ) : (
                <span className="text-cream-faint">— not yet issued —</span>
              )}
            </Section>

            <Section title="Welcome & first login">
              <KV label="Welcome accepted">
                {bundle.row.welcomeAcceptedAt
                  ? formatDateTime(bundle.row.welcomeAcceptedAt)
                  : '—'}
              </KV>
              <KV label="Last login">
                {bundle.row.lastLoginAt ? formatDateTime(bundle.row.lastLoginAt) : '—'}
              </KV>
            </Section>

            <Section title="2-in-72 progress">
              <KV label="Trailing 72h">{bundle.row.twoInSeventyTwoCount}</KV>
              <KV label="Window opened">
                {formatDateTime(bundle.row.twoInSeventyTwoWindowStart)}
              </KV>
            </Section>

            <Section title="Invite activity">
              <KV label="Lifetime invites">{bundle.row.personalInvitesCount}</KV>
              <KV label="Oldest open follow-up">
                {bundle.row.oldestOpenFollowUpDueAt
                  ? formatDateTime(bundle.row.oldestOpenFollowUpDueAt)
                  : '—'}
              </KV>
            </Section>

            <Section title="Training (Fast Start)">
              <KV label="Modules completed">
                {bundle.row.trainingModulesCompleted}/5
                {bundle.row.trainingComplete && (
                  <span className="ml-2 text-[10px] font-mono text-teal uppercase tracking-label">
                    complete
                  </span>
                )}
              </KV>
            </Section>

            <Section title="Michael interview">
              {bundle.michaelTranscript ? (
                <div className="space-y-1">
                  <KV label="Completed">
                    {bundle.michaelTranscript.completedAt
                      ? formatDateTime(bundle.michaelTranscript.completedAt)
                      : '—'}
                  </KV>
                  <KV label="Interview id">
                    <span className="font-mono text-cream-mute">
                      {bundle.michaelTranscript.interviewId ?? '—'}
                    </span>
                  </KV>
                  {bundle.michaelTranscript.audioUrl && (
                    <KV label="Recording">
                      <a
                        href={bundle.michaelTranscript.audioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold hover:underline"
                      >
                        open recording
                      </a>
                    </KV>
                  )}
                  <p className="text-[11px] font-mono text-cream-faint mt-2 uppercase tracking-label">
                    Full transcript lives in Audit / Section J
                  </p>
                </div>
              ) : (
                <p className="text-cream-faint">— no interview on file —</p>
              )}
            </Section>

            <Section title="Leader tags">
              <div className="flex items-center gap-2">
                {bundle.row.systemDetectedLeader ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-label border border-gold/40 text-gold bg-gold/[0.06]">
                    system
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-cream-faint uppercase tracking-label">
                    system: —
                  </span>
                )}
                <span
                  className={[
                    'text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-label border',
                    bundle.row.curatedLeader
                      ? 'border-teal/40 text-teal bg-teal/[0.06]'
                      : 'border-line text-cream-faint',
                  ].join(' ')}
                >
                  curated: {bundle.row.curatedLeader ? 'yes' : 'no'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-cream-faint mt-3">
                Toggle the curated badge directly from the row in the directory.
              </p>
            </Section>

            <Section title="Kevin notes (append-only)">
              <NotesPanel
                baId={bundle.row.baId}
                notes={bundle.notes}
                onAppended={onNoteAppended}
              />
            </Section>
          </div>
        )}

        {overrideOpen && bundle && (
          <SponsorOverrideFlow
            row={bundle.row}
            onCancel={() => setOverrideOpen(false)}
            onApplied={onOverrideApplied}
          />
        )}
      </aside>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-center justify-between mb-2">
        <h3 className="font-display text-[14px] text-cream uppercase tracking-eyebrow">
          {title}
        </h3>
        {right}
      </header>
      <div className="border border-line rounded-md p-4 space-y-1.5">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="font-mono tracking-label text-[10px] uppercase text-cream-faint w-40 shrink-0">
        {label}
      </span>
      <span className="text-cream">{children}</span>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: AdminBaDirectoryRow['status'];
}) {
  const cls =
    status === 'active'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : status === 'suspended'
      ? 'text-red-400 border-red-400/30 bg-red-400/[0.06]'
      : 'text-cream-faint border-line bg-cream/[0.025]';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

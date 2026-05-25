/**
 * D.2 — prospect detail panel.
 *
 * Right-side slide-in panel. Opens on prospect-name click OR via the
 * deep-link contract `?prospectId=<id>` (locked with Agent E for
 * queue-lookup and ticker entries).
 *
 * Sections rendered, top-down:
 *   • Identity + sponsor drift detector (D.2)
 *   • Token + sponsor-routed URL (clickable → in-panel sandbox preview)
 *   • Sandbox preview snapshot (loaded on-demand; PURE READ; never
 *     advances /p/{token} state — backed by
 *     GET /api/admin/prospects/:id/sandbox-preview)
 *   • Callback / webinar / enrollment details (when present)
 *   • Activity timeline (chronological, includes admin actions)
 *   • Kevin's append-only notes
 *   • D.4 intervention buttons → InterventionModal
 *
 * Compliance discipline visible here (D.3):
 *   - No score, rank, qualification rating, or AI coaching.
 *   - "Sponsor drift" surfaces a verified mismatch — it never speculates
 *     about WHY the drift exists. Kevin reads the audit log.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AdminProspectActivityEvent,
  AdminProspectDetail,
  AdminProspectDetailResponse,
  AdminProspectDirectoryRow,
  AdminProspectInterventionKind,
  AdminProspectInterventionResponse,
  AdminProspectKevinNote,
  ResolvedTokenPayload,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { InterventionModal } from '@/components/prospect-oversight/InterventionModal';

interface Props {
  prospectId: string;
  onClose: () => void;
  onRowRefreshed: (row: AdminProspectDirectoryRow) => void;
}

type SandboxPreview = ResolvedTokenPayload & { sandbox: true };

export function DetailPanel({ prospectId, onClose, onRowRefreshed }: Props) {
  const [detail, setDetail] = useState<AdminProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<SandboxPreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [activeIntervention, setActiveIntervention] =
    useState<AdminProspectInterventionKind | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/prospects/${encodeURIComponent(prospectId)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as AdminProspectDetailResponse & {
        error?: string;
      };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load prospect detail.');
        return;
      }
      setDetail(data.detail);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const openPreview = useCallback(async () => {
    setPreviewOpen(true);
    if (preview) return;
    setPreviewErr(null);
    try {
      const res = await fetch(
        `/api/admin/prospects/${encodeURIComponent(prospectId)}/sandbox-preview`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as
        | { ok: true; payload: SandboxPreview }
        | { ok: false; error: string };
      if (!data.ok) {
        setPreviewErr(data.error);
        return;
      }
      setPreview(data.payload);
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : 'unknown');
    }
  }, [preview, prospectId]);

  const handleAddNote = useCallback(async () => {
    if (!noteDraft.trim()) return;
    setNoteSaving(true);
    setNoteErr(null);
    try {
      const res = await fetch(
        `/api/admin/prospects/${encodeURIComponent(prospectId)}/notes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: noteDraft.trim() }),
        },
      );
      const data = (await res.json()) as
        | { ok: true; note: AdminProspectKevinNote }
        | { ok: false; error: string };
      if (!data.ok) {
        setNoteErr(data.error);
        return;
      }
      setDetail((prev) =>
        prev ? { ...prev, kevinNotes: [...prev.kevinNotes, data.note] } : prev,
      );
      setNoteDraft('');
    } catch (e) {
      setNoteErr(e instanceof Error ? e.message : 'unknown');
    } finally {
      setNoteSaving(false);
    }
  }, [noteDraft, prospectId]);

  const handleInterventionDone = useCallback(
    (resp: AdminProspectInterventionResponse) => {
      // Refresh directory row in place.
      onRowRefreshed(resp.refreshedRow);
      // Refetch detail to pick up the new audit-log event + state changes.
      setActiveIntervention(null);
      void loadDetail();
    },
    [loadDetail, onRowRefreshed],
  );

  return (
    <aside
      className="fixed top-0 right-0 h-screen w-[640px] bg-ink border-l border-line overflow-y-auto z-40 shadow-[-10px_0_30px_rgba(0,0,0,0.4)]"
      role="dialog"
      aria-modal="false"
    >
      <header className="sticky top-0 bg-ink border-b border-line px-6 py-4 flex items-start justify-between z-10">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            Section D.2 · Prospect Detail
          </p>
          {detail ? (
            <h2 className="font-display text-[22px] leading-none mt-1">
              {detail.firstName} {detail.lastName}
            </h2>
          ) : (
            <h2 className="font-display text-[22px] leading-none mt-1 text-cream-faint">
              Loading…
            </h2>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      <div className="px-6 py-5 space-y-7">
        {err && (
          <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{err}</p>
        )}
        {loading && !detail && (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            Loading…
          </p>
        )}

        {detail && (
          <>
            <IdentitySection detail={detail} />
            <TokenSection
              detail={detail}
              previewOpen={previewOpen}
              preview={preview}
              previewErr={previewErr}
              onTogglePreview={() =>
                previewOpen ? setPreviewOpen(false) : void openPreview()
              }
            />

            {detail.callback && (
              <Section eyebrow="Callback request">
                <KV k="Intent" v={detail.callback.intent} />
                <KV k="Submitted" v={formatDateTime(detail.callback.submittedAt)} />
                <KV k="Request ID" v={detail.callback.callbackRequestId} mono />
              </Section>
            )}

            {detail.webinar && (
              <Section eyebrow="Webinar reservation">
                <KV k="Event ID" v={detail.webinar.eventId} mono />
                <KV k="Reserved" v={formatDateTime(detail.webinar.reservedAt)} />
                <KV k="Reservation ID" v={detail.webinar.reservationId} mono />
              </Section>
            )}

            {detail.enrollment && (
              <Section eyebrow="Enrollment">
                <KV k="Marked at" v={formatDateTime(detail.enrollment.markedAt)} />
                <KV k="Marked by BA" v={detail.enrollment.markedByBaId} mono />
                <KV
                  k="Source"
                  v={
                    detail.enrollment.forceEnrolledByAdmin
                      ? 'Force-enrolled by admin'
                      : 'Marked by inviting BA'
                  }
                />
              </Section>
            )}

            <ActivityTimeline events={detail.activity} />
            <KevinNotesSection
              notes={detail.kevinNotes}
              draft={noteDraft}
              onDraftChange={setNoteDraft}
              onAdd={handleAddNote}
              saving={noteSaving}
              error={noteErr}
            />
            <InterventionLauncher
              onSelect={(k) => setActiveIntervention(k)}
              terminalState={
                detail.state === 'enrolled' || detail.state === 'expired'
              }
            />
          </>
        )}
      </div>

      {activeIntervention && detail && (
        <InterventionModal
          kind={activeIntervention}
          detail={detail}
          onClose={() => setActiveIntervention(null)}
          onDone={handleInterventionDone}
        />
      )}
    </aside>
  );
}

/* ─── section primitives ────────────────────────────────────────── */

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line rounded-md p-4">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-3">
        {eyebrow}
      </p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KV({
  k,
  v,
  mono = false,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  tone?: 'warn' | 'ok' | 'mute';
}) {
  const toneClass =
    tone === 'warn'
      ? 'text-red-400'
      : tone === 'ok'
        ? 'text-teal'
        : tone === 'mute'
          ? 'text-cream-faint'
          : 'text-cream';
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint pt-0.5">
        {k}
      </span>
      <span className={[toneClass, mono ? 'font-mono text-[12px]' : ''].join(' ')}>
        {v}
      </span>
    </div>
  );
}

/* ─── identity + sponsor drift ──────────────────────────────────── */

function IdentitySection({ detail }: { detail: AdminProspectDetail }) {
  const drift = detail.sponsorBaIdAtMint !== detail.sponsorBaIdNow;
  return (
    <Section eyebrow="Identity">
      <KV
        k="Name"
        v={`${detail.firstName} ${detail.lastName}`}
      />
      <KV k="Phone" v={detail.phone ?? <em className="text-cream-faint">none</em>} />
      <KV k="Email" v={detail.email ?? <em className="text-cream-faint">none</em>} />
      <KV
        k="Location"
        v={`${detail.location.city}, ${detail.location.stateOrRegion} · ${detail.location.country}`}
      />
      <KV
        k="Sponsor now"
        v={`${detail.sponsorNameNow} · ${detail.sponsorBaIdNow}`}
        mono={false}
      />
      <KV k="Sponsor at mint" v={detail.sponsorBaIdAtMint} mono tone={drift ? 'warn' : 'mute'} />
      {drift && (
        <div className="mt-1 px-3 py-2 border border-red-400/40 rounded text-[12px] text-red-400">
          Sponsor drift detected. The inviting BA on the original token does
          not match the current sponsor on the prospect record. Check the
          audit log for the reassign / move that caused this.
        </div>
      )}
      <KV
        k="Position"
        v={detail.positionNumber !== null ? `#${detail.positionNumber}` : '—'}
        mono
      />
      <KV
        k="Placed at"
        v={detail.placedAt ? formatDateTime(detail.placedAt) : '—'}
      />
      <KV k="State" v={detail.state} mono />
      <KV k="Handoff state" v={detail.registrationHandoffState} mono />
    </Section>
  );
}

/* ─── token details + sandbox preview launcher ──────────────────── */

function TokenSection({
  detail,
  previewOpen,
  preview,
  previewErr,
  onTogglePreview,
}: {
  detail: AdminProspectDetail;
  previewOpen: boolean;
  preview: SandboxPreview | null;
  previewErr: string | null;
  onTogglePreview: () => void;
}) {
  return (
    <Section eyebrow="Token + sponsor-routed URL">
      <KV k="Token" v={detail.token.tokenTruncated} mono />
      <KV
        k="Prospect URL"
        v={
          detail.token.prospectUrl ? (
            <span className="font-mono text-[12px] text-teal break-all">
              {detail.token.prospectUrl}
            </span>
          ) : (
            <em className="text-cream-faint">no token row</em>
          )
        }
      />
      <KV k="Minted" v={formatDateTime(detail.token.mintedAt)} />
      <KV k="Expires" v={formatDateTime(detail.token.expiresAt)} />
      <KV k="Current state" v={detail.token.currentState} mono />
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onTogglePreview}
          disabled={!detail.token.prospectUrl}
        >
          {previewOpen ? 'Hide sandbox preview' : 'Open sandbox preview'}
        </Button>
        <p className="text-[11px] font-mono text-cream-faint mt-2">
          Pure read · does NOT fire a real link-click event or advance any state.
        </p>
      </div>
      {previewOpen && (
        <div className="mt-4 border-t border-line pt-4 space-y-2">
          {previewErr && (
            <p className="text-[12px] font-mono text-red-400">{previewErr}</p>
          )}
          {preview ? (
            <>
              <KV k="State" v={preview.state} mono />
              <KV
                k="Prospect"
                v={`${preview.prospect.firstName} ${preview.prospect.lastInitial}. · ${preview.prospect.city}, ${preview.prospect.stateOrRegion}`}
              />
              <KV
                k="Position"
                v={
                  preview.prospect.positionNumber !== null
                    ? `#${preview.prospect.positionNumber}`
                    : '—'
                }
                mono
              />
              <KV
                k="Placed at"
                v={preview.prospect.placedAt ? formatDateTime(preview.prospect.placedAt) : '—'}
              />
              <KV k="Expires" v={formatDateTime(preview.prospect.expiresAt)} />
              <KV
                k="Inviting BA"
                v={`${preview.ba.fullName} · ${preview.ba.baId}`}
              />
              <KV k="Video" v={preview.videoUrl} mono />
              <KV
                k="Webinar slot"
                v={`${preview.webinar.dayOfWeek} ${preview.webinar.timeOfDay} ${preview.webinar.timezone}`}
              />
              <KV
                k="Next event"
                v={
                  preview.nextEvent
                    ? `${formatDateTime(preview.nextEvent.scheduledFor)} · ${preview.nextEvent.eventId}`
                    : '—'
                }
                mono
              />
            </>
          ) : !previewErr ? (
            <p className="text-[12px] font-mono text-cream-faint">Loading preview…</p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

/* ─── activity timeline ─────────────────────────────────────────── */

function ActivityTimeline({ events }: { events: AdminProspectActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <Section eyebrow="Activity timeline">
        <p className="text-[12px] font-mono text-cream-faint">No activity yet.</p>
      </Section>
    );
  }
  return (
    <Section eyebrow="Activity timeline">
      <ol className="space-y-2">
        {events.map((e) => (
          <li
            key={e.eventId}
            className="grid grid-cols-[140px_1fr] gap-3 text-sm"
          >
            <span className="text-[11px] font-mono tracking-label text-cream-faint pt-0.5">
              {formatDateTime(e.at)}
            </span>
            <div>
              <div className={isAdminEvent(e.kind) ? 'text-gold' : 'text-cream'}>
                {e.label}
              </div>
              {(e.details?.reason as string) && (
                <div className="text-[12px] text-cream-mute italic mt-0.5">
                  {String(e.details?.reason)}
                </div>
              )}
              {e.ip && (
                <div className="text-[11px] font-mono text-cream-faint mt-0.5">
                  ip: {e.ip}
                  {e.referrer ? ` · ref: ${e.referrer}` : ''}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function isAdminEvent(kind: AdminProspectActivityEvent['kind']): boolean {
  return kind.startsWith('admin_');
}

/* ─── Kevin notes ───────────────────────────────────────────────── */

function KevinNotesSection({
  notes,
  draft,
  onDraftChange,
  onAdd,
  saving,
  error,
}: {
  notes: AdminProspectKevinNote[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <Section eyebrow="Admin notes (append-only)">
      {notes.length === 0 && (
        <p className="text-[12px] font-mono text-cream-faint">No notes yet.</p>
      )}
      {notes.map((n) => (
        <div key={n.noteId} className="border-b border-line/40 pb-2 mb-2 last:border-b-0">
          <p className="text-[11px] font-mono text-cream-faint">
            {formatDateTime(n.createdAt)} · {n.createdByDisplayName}
          </p>
          <p className="text-cream text-sm whitespace-pre-wrap mt-1">{n.body}</p>
        </div>
      ))}
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Append a private note…"
        className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-cream font-body resize-y min-h-[80px] mt-2"
        disabled={saving}
      />
      <div className="flex items-center gap-3 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={saving || !draft.trim()}
        >
          {saving ? 'Saving…' : 'Append note'}
        </Button>
        {error && (
          <span className="text-[12px] font-mono text-red-400">{error}</span>
        )}
      </div>
    </Section>
  );
}

/* ─── intervention launcher ─────────────────────────────────────── */

function InterventionLauncher({
  onSelect,
  terminalState,
}: {
  onSelect: (kind: AdminProspectInterventionKind) => void;
  terminalState: boolean;
}) {
  return (
    <Section eyebrow="BA-requested interventions (D.4)">
      <p className="text-[12px] text-cream-mute mb-3">
        Emergency safety levers. Every intervention requires a requesting
        BA's ID and a reason; the server writes a critical audit entry with
        before / after / requesting BA / reason / timestamp. Position numbers
        are preserved (monotonic): flush vacates a slot, move keeps the same
        position, only inviting BA changes.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect('move')}
          disabled={terminalState}
        >
          Move to another BA
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect('reassign_sponsor')}
          disabled={terminalState}
        >
          Reassign sponsor
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect('manual_flush')}
          disabled={terminalState}
        >
          Manual flush
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect('force_enroll')}
          disabled={terminalState}
        >
          Force enroll
        </Button>
      </div>
      {terminalState && (
        <p className="text-[11px] font-mono text-cream-faint mt-2">
          Interventions disabled — prospect is in a terminal state.
        </p>
      )}
    </Section>
  );
}

/* ─── formatting ────────────────────────────────────────────────── */

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Michael Training Support card (feature/michael-training-support).
 *
 * Sponsor-only render of a downline BA's training-support guidance — projected
 * from Steve's SuccessProfile (steve_discoveries) by the server. The sponsor
 * uses this to meet the new BA where they are during training: how they learn,
 * how to stay in touch, where to focus support, and any recommendations Steve
 * surfaced from the discovery conversation.
 *
 * Access is enforced SERVER-SIDE — GET /api/michael/training-support/:downlineBaId
 * returns 403 with code=NOT_SPONSOR unless the requesting session's BA is the
 * direct sponsor of the downline. This component never receives card data for a
 * downline the user isn't entitled to read.
 *
 * Compliance: BA-language read-back only. The card never surfaces income,
 * placement, or comp math — it's the BA's own discovery answers + light
 * structural guidance.
 *
 * Per .team convention (cockpit.tsx, TrackRecordCard.tsx): wire shapes are
 * declared locally rather than imported from @momentum/shared (the shared
 * `src` alias is outside this app's rootDir and trips TS6059). Source of truth
 * for MichaelTrainingSupportCard is packages/shared/src/types.ts.
 */

import { useCallback, useEffect, useState } from 'react';

// ── Local wire shape (mirror of packages/shared/src/types.ts) ──────────────

interface MichaelTrainingSupportGuidanceSection {
  label: string;
  bullets: string[];
}

interface MichaelTrainingSupportCardData {
  downlineBaId: string;
  downlineFirstName: string;
  derivedFromSteveAt: string;
  primaryWhy: string;
  successVision: string;
  learningStyle: MichaelTrainingSupportGuidanceSection;
  communication: MichaelTrainingSupportGuidanceSection;
  supportFocus: MichaelTrainingSupportGuidanceSection;
  trainingRecommendations: string[];
  michaelHandoffSummary: string;
  signedBy: string;
}

// ── Component ──────────────────────────────────────────────────────────────

interface MichaelTrainingSupportCardProps {
  downlineBaId: string;
}

type CardState =
  | { kind: 'loading' }
  | { kind: 'not_complete' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; card: MichaelTrainingSupportCardData };

export function MichaelTrainingSupportCard({
  downlineBaId,
}: MichaelTrainingSupportCardProps) {
  const [state, setState] = useState<CardState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/michael/training-support/${encodeURIComponent(downlineBaId)}`,
        { credentials: 'include' },
      );
      if (res.status === 403) {
        setState({ kind: 'forbidden' });
        return;
      }
      if (res.status === 404) {
        // Either no downline or no Steve discovery yet — from the sponsor's
        // POV both mean "discovery pending."
        setState({ kind: 'not_complete' });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        card?: MichaelTrainingSupportCardData;
        error?: string;
      };
      if (!data.ok || !data.card) {
        setState({
          kind: 'error',
          message: data.error ?? 'Could not load training-support card.',
        });
        return;
      }
      setState({ kind: 'ready', card: data.card });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setState({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, [downlineBaId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <CardShell>
        <CardEyebrow text="Loading…" tone="mute" />
      </CardShell>
    );
  }
  if (state.kind === 'forbidden') {
    return (
      <CardShell>
        <CardEyebrow text="Sponsor-only" tone="mute" />
        <p className="text-cream-mute text-[13px] mt-2">
          This card is visible to the direct sponsor only.
        </p>
      </CardShell>
    );
  }
  if (state.kind === 'not_complete') {
    return (
      <CardShell>
        <CardEyebrow text="Discovery pending" tone="mute" />
        <p className="text-cream-mute text-[13px] mt-2">
          Steve hasn&rsquo;t completed this BA&rsquo;s discovery yet, or the
          profile is still being assembled.
        </p>
      </CardShell>
    );
  }
  if (state.kind === 'error') {
    return (
      <CardShell>
        <CardEyebrow text="Card error" tone="error" />
        <p className="text-red-400 text-[13px] mt-2">{state.message}</p>
      </CardShell>
    );
  }

  const { card } = state;
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-4 gap-4">
        <CardEyebrow text="Michael training support" tone="gold" />
        <span className="font-mono tracking-[0.06em] text-[11px] text-cream-faint">
          {formatDerivedAt(card.derivedFromSteveAt)}
        </span>
      </div>
      <h3 className="font-display text-[22px] text-cream leading-tight mb-1">
        {card.downlineFirstName || card.downlineBaId}
      </h3>
      <p className="font-mono tracking-[0.18em] text-[11px] text-gold mb-5 uppercase">
        How to support their training
      </p>

      {(card.primaryWhy || card.successVision) && (
        <div className="mb-5 bg-gold/[0.05] border border-gold/20 rounded-md p-4 space-y-3">
          {card.primaryWhy && (
            <StatementBlock label="Primary why" text={card.primaryWhy} />
          )}
          {card.successVision && (
            <StatementBlock label="Vision of success" text={card.successVision} />
          )}
        </div>
      )}

      <div className="space-y-4 mb-5">
        <GuidanceBlock section={card.learningStyle} />
        <GuidanceBlock section={card.communication} />
        <GuidanceBlock section={card.supportFocus} />
      </div>

      {card.trainingRecommendations.length > 0 && (
        <div className="mb-5">
          <p className="font-mono tracking-[0.14em] text-[10px] text-teal uppercase mb-2">
            Training recommendations
          </p>
          <ul className="list-disc list-inside space-y-1">
            {card.trainingRecommendations.map((r) => (
              <li key={r} className="text-cream-mute text-[13px] leading-[1.5]">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.michaelHandoffSummary && (
        <div className="mb-5 border-l border-teal/30 pl-4">
          <p className="font-mono tracking-[0.14em] text-[10px] text-teal uppercase mb-1">
            Handoff summary
          </p>
          <p className="text-cream text-[13px] leading-[1.55]">
            {card.michaelHandoffSummary}
          </p>
        </div>
      )}

      <p className="mt-4 font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase">
        Signed: {card.signedBy}
      </p>
    </CardShell>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function StatementBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="font-mono tracking-[0.14em] text-[10px] text-gold uppercase mb-1">
        {label}
      </p>
      <p className="text-cream text-[14px] leading-[1.5]">{text}</p>
    </div>
  );
}

function GuidanceBlock({
  section,
}: {
  section: MichaelTrainingSupportGuidanceSection;
}) {
  if (section.bullets.length === 0) {
    return (
      <div className="border-l border-cream/10 pl-4">
        <p className="font-mono tracking-[0.14em] text-[10px] text-cream-faint uppercase mb-1">
          {section.label}
        </p>
        <p className="text-cream-faint text-[12px] italic leading-[1.45]">
          Not captured in discovery.
        </p>
      </div>
    );
  }
  return (
    <div className="border-l border-gold/30 pl-4">
      <p className="font-mono tracking-[0.14em] text-[10px] text-gold uppercase mb-1">
        {section.label}
      </p>
      <ul className="list-disc list-inside space-y-0.5">
        {section.bullets.map((b) => (
          <li key={b} className="text-cream text-[13px] leading-[1.5]">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream/[0.025] border border-cream/10 rounded-md p-5">
      {children}
    </div>
  );
}

function CardEyebrow({
  text,
  tone,
}: {
  text: string;
  tone: 'gold' | 'mute' | 'error';
}) {
  const color =
    tone === 'gold'
      ? 'text-gold'
      : tone === 'error'
        ? 'text-red-400'
        : 'text-cream-faint';
  return (
    <p className={`font-mono tracking-[0.22em] text-[11px] uppercase ${color}`}>
      {text}
    </p>
  );
}

function formatDerivedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return iso;
  }
}

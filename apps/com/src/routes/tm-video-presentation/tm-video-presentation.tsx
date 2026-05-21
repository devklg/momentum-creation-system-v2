/**
 * tm-video-presentation — Page Composer (Chat #107)
 *
 * Locked source: locked-spec Part 4.3 (eleven sections per Chat #39
 * schematic + Chat #84 corrections) + COM Design B.1 (verbatim copy
 * where the handoff is silent). Per Kevin's Chat #107 sign-off:
 *   • B's 11-section structure is canonical
 *   • A's verbatim copy folded in where B is silent
 *   • Ticker strip from A1 KEPT as fixed top bar above Section 1
 *   • A's "Part 5 Real Results" testimonials block DEFERRED to v1.1
 *
 * Responsibilities (unchanged from Chat #106):
 *   1. Ink + atmosphere shell (gradient mesh + film grain).
 *   2. Thread `prospectFirstName` + `baFirstName` + `baFullName` to
 *      every section that needs them.
 *   3. Own the YouTube state machine state. Section 3 wires the
 *      actual YT.Player.
 *   4. On video_complete from Section 3, swap render to the
 *      tm-prospect-dashboard placeholder (real dashboard ships its
 *      own chat).
 *
 * Section list (in render order):
 *   0. TickerStrip  — fixed top bar (A1)
 *   1. PersonalOpen — full-bleed hero (Chat #106 shipped)
 *   2. Invitation
 *   3. DrDanVideo   — YouTube + milestone wiring
 *   4. Market       — 4-tile stat grid
 *   5. PharmaceuticalSolution
 *   6. NaturalPath  — comparison card
 *   7. Dossier      — accordion + PDF download
 *   8. KevinStory   — luxury-favorite.jpeg as-is
 *   9. Timing       — three-factor convergence + closing line
 *  10. QuietDoor    — placeholder card (Chat #108 builds the real CTA)
 *  11. Footer
 */

import { useCallback, useMemo, useState } from "react";

import TickerStrip from "./sections/00-TickerStrip";
import { PersonalOpen } from "./sections/01-PersonalOpen";
import Invitation from "./sections/02-Invitation";
import DrDanVideo from "./sections/03-DrDanVideo";
import Market from "./sections/04-Market";
import PharmaceuticalSolution from "./sections/05-PharmaceuticalSolution";
import NaturalPath from "./sections/06-NaturalPath";
import Dossier from "./sections/07-Dossier";
import KevinStory from "./sections/08-KevinStory";
import Timing from "./sections/09-Timing";
import QuietDoor from "./sections/10-QuietDoor";
import Footer from "./sections/11-Footer";

// ---------------------------------------------------------------
// Types — mirror Chat #105's shared discriminated union locally so
// this file is independently readable. When the shared package is
// imported, replace these with the imports.
// ---------------------------------------------------------------

export type VideoEventKind =
  | "started"
  | "quarter"
  | "half"
  | "three_quarter"
  | "complete";

export type ResolveTokenState =
  | "clicked"
  | "video_started"
  | "video_quarter"
  | "video_half"
  | "video_three_quarter"
  | "video_complete"
  | "callback_requested"
  | "enrolled"
  | "expired"
  | "invalid_token";

export interface ResolveTokenResponse {
  token: string;
  state: ResolveTokenState;
  prospectFirstName: string;
  baFullName: string;
  positionNumber?: number;
  placedAt?: string;
}

export interface VideoCompletePlacement {
  positionNumber: number;
  placedAt: string;
}

// ---------------------------------------------------------------
// Composer
// ---------------------------------------------------------------

export interface TmVideoPresentationProps {
  resolved: ResolveTokenResponse;
}

export function TmVideoPresentation({ resolved }: TmVideoPresentationProps) {
  const { token, prospectFirstName, baFullName } = resolved;
  const baFirstName = useMemo(
    () => baFullName.trim().split(/\s+/)[0] ?? baFullName,
    [baFullName]
  );

  // ---- Video state machine -------------------------------------
  const initialState: ResolveTokenState = resolved.state;

  const initialFired = useMemo<Set<VideoEventKind>>(() => {
    const s = new Set<VideoEventKind>();
    const order: ResolveTokenState[] = [
      "video_started",
      "video_quarter",
      "video_half",
      "video_three_quarter",
      "video_complete",
    ];
    const idx = order.indexOf(initialState);
    if (idx >= 0) {
      const kinds: VideoEventKind[] = [
        "started",
        "quarter",
        "half",
        "three_quarter",
        "complete",
      ];
      for (let i = 0; i <= idx; i++) {
        const kind = kinds[i];
        if (kind) s.add(kind);
      }
    }
    return s;
  }, [initialState]);
  const [firedMilestones, setFiredMilestones] =
    useState<Set<VideoEventKind>>(initialFired);

  // Placement captured on video_complete server response.
  const [placement, setPlacement] = useState<VideoCompletePlacement | null>(
    resolved.state === "video_complete" &&
      resolved.positionNumber !== undefined &&
      resolved.placedAt !== undefined
      ? { positionNumber: resolved.positionNumber, placedAt: resolved.placedAt }
      : null
  );

  // Callback passed to Section 3. Section 3 calls postVideoEvent and
  // on successful response calls this. Server is idempotent; client-
  // side dedup happens via firedMilestones for cleaner UX.
  const handleMilestone = useCallback(
    (kind: VideoEventKind, placementResult?: VideoCompletePlacement) => {
      setFiredMilestones((prev) => {
        if (prev.has(kind)) return prev;
        const next = new Set(prev);
        next.add(kind);
        return next;
      });

      if (kind === "complete" && placementResult) {
        setPlacement(placementResult);
      }
    },
    []
  );

  // ---- Render branch -------------------------------------------
  if (placement) {
    return (
      <ProspectDashboardPlaceholder
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        positionNumber={placement.positionNumber}
        placedAt={placement.placedAt}
      />
    );
  }

  return (
    <main className="tm-video-presentation">
      {/* Ticker strip is fixed-position — render at top of composer
          tree so it overlays content from the very top of the
          viewport. Its 36px height is accounted for by the section
          below adding scroll-margin-top equal to that height. */}
      <TickerStrip baFirstName={baFirstName} />

      <PersonalOpen
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
      />

      <Invitation
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        baFirstName={baFirstName}
      />

      <DrDanVideo
        token={token}
        onMilestone={handleMilestone}
        firedMilestones={firedMilestones}
      />

      <Market />
      <PharmaceuticalSolution />
      <NaturalPath />
      <Dossier />
      <KevinStory />
      <Timing />
      <QuietDoor token={token} baFirstName={baFirstName} />
      <Footer baFullName={baFullName} />

      <ShellStyles />
    </main>
  );
}

// ---------------------------------------------------------------
// Dashboard placeholder — unchanged from Chat #106.
// ---------------------------------------------------------------

interface ProspectDashboardPlaceholderProps {
  prospectFirstName: string;
  baFullName: string;
  positionNumber: number;
  placedAt: string;
}
function ProspectDashboardPlaceholder({
  prospectFirstName,
  baFullName,
  positionNumber,
  placedAt,
}: ProspectDashboardPlaceholderProps) {
  const placedDate = useMemo(() => {
    try {
      return new Date(placedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return placedAt;
    }
  }, [placedAt]);

  return (
    <main className="tm-dashboard-placeholder">
      <section className="tm-dashboard-placeholder__inner">
        <div className="tm-dashboard-placeholder__eyebrow">
          {prospectFirstName} · placed in the team line
        </div>
        <div className="tm-dashboard-placeholder__position">
          #{positionNumber.toLocaleString()}
        </div>
        <p className="tm-dashboard-placeholder__lede">
          You are in. {baFullName} will know.
        </p>
        <p className="tm-dashboard-placeholder__meta">Placed {placedDate}.</p>
        <p className="tm-dashboard-placeholder__note">
          Your full team view is being prepared.
        </p>
        <div className="tm-dashboard-placeholder__rule" />
      </section>
      <ShellStyles />
    </main>
  );
}

// ---------------------------------------------------------------
// Shell styles — ink + atmosphere + section transitions
// ---------------------------------------------------------------

function ShellStyles() {
  return <style>{shellCss}</style>;
}

const shellCss = `
  .tm-video-presentation,
  .tm-dashboard-placeholder {
    position: relative;
    min-height: 100svh;
    background: #0A0A0A;
    color: #F5EFE6;
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow-x: hidden;
  }
  /* Push the page content down to make room for the fixed ticker. */
  .tm-video-presentation { padding-top: 36px; }

  .tm-video-presentation::before,
  .tm-dashboard-placeholder::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(900px circle at 12% 8%, rgba(201, 168, 76, 0.10), transparent 55%),
      radial-gradient(700px circle at 88% 95%, rgba(45, 212, 191, 0.08), transparent 55%),
      radial-gradient(500px circle at 50% 50%, rgba(201, 168, 76, 0.04), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  .tm-video-presentation::after,
  .tm-dashboard-placeholder::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.96 0 0 0 0 0.93 0 0 0 0 0.85 0 0 0 0.04 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>");
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
  }
  .tm-video-presentation > *,
  .tm-dashboard-placeholder > * {
    position: relative;
    z-index: 2;
  }

  /* ---- dashboard placeholder -------------------------------------- */
  .tm-dashboard-placeholder { display: flex; align-items: center; justify-content: center; }
  .tm-dashboard-placeholder__inner {
    max-width: 720px;
    padding: clamp(48px, 8vw, 96px) clamp(20px, 5vw, 56px);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(14px, 2vw, 22px);
  }
  .tm-dashboard-placeholder__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
  }
  .tm-dashboard-placeholder__position {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(80px, 14vw, 180px);
    line-height: 0.95;
    color: #F5C030;
    letter-spacing: 0.005em;
  }
  .tm-dashboard-placeholder__lede {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(28px, 3.5vw, 44px);
    line-height: 1.1;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }
  .tm-dashboard-placeholder__meta {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    margin: 0;
  }
  .tm-dashboard-placeholder__note {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 15px;
    color: rgba(245, 239, 230, 0.62);
    margin: 0;
    max-width: 42ch;
  }
  .tm-dashboard-placeholder__rule {
    width: 48px;
    height: 1px;
    background: rgba(201, 168, 76, 0.45);
    margin-top: 16px;
  }
`;

export default TmVideoPresentation;

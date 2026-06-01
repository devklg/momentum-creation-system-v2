/**
 * tm-video-presentation — Page Composer (Chat #107, nav reworked Chat #126)
 *
 * Locked source: locked-spec Part 4.3 (eleven sections per Chat #39
 * schematic + Chat #84 corrections) + COM Design B.1 (verbatim copy
 * where the handoff is silent). Per Kevin's Chat #107 sign-off:
 *   • B's 11-section structure is canonical
 *   • A's verbatim copy folded in where B is silent
 *   • Ticker strip from A1 KEPT as fixed top bar above Section 1
 *   • A's "Part 5 Real Results" testimonials block DEFERRED to v1.1
 *
 * Responsibilities:
 *   1. Ink + atmosphere shell (gradient mesh + film grain).
 *   2. Thread `prospectFirstName` + `baFirstName` + `baFullName` to
 *      every section that needs them.
 *   3. Own the YouTube state machine state. Section 3 wires the
 *      actual YT.Player.
 *   4. Own the presentation<->dashboard VIEW state and the ?view= URL
 *      param (Chat #126).
 *
 * Chat #126 — completion-interrupt fix + presentation<->dashboard nav:
 *   PREVIOUS BEHAVIOR (the bug): the composer force-swapped the entire
 *   page to the dashboard the instant `placement` was set
 *   (`if (placement) return <TmProspectDashboard/>`). A prospect reading
 *   the dossier / market stats below the video got yanked to the
 *   dashboard mid-scroll the moment the video hit ~95%, and could not
 *   finish reading the presentation.
 *
 *   NEW BEHAVIOR (locked Chat #126): placement is DECOUPLED from
 *   navigation. video_complete still places the prospect silently +
 *   server-side (unchanged, Part 3.4) and we capture the position; but
 *   completion no longer changes which surface renders. The prospect
 *   stays on the presentation and reads freely. They cross to the
 *   dashboard only when THEY choose — via the closing Section 10
 *   (WhatsNext) CTA, or a ?view=dashboard URL.
 *
 *   The view is driven by a ?view= URL param so the choice is
 *   bookmarkable + shareable and survives a refresh (a prospect studying
 *   the page across the 8-week window can deep-link back to either
 *   surface). The dashboard view is GATED on placement existing — we
 *   never render the team line before the prospect has a position; a
 *   ?view=dashboard before completion falls back to the presentation.
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
 *  10. WhatsNext    — assumptive "you've been placed / see the team"
 *                     closer; CTA crosses to the dashboard (Chat #126,
 *                     replaces the Chat #109 QuietDoor callback section)
 *  11. Footer
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ComProspectCopy } from "@momentum/shared";

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
import Leadership from "./sections/12-Leadership";
import WhatsNext from "./sections/10-WhatsNext";
import Footer from "./sections/11-Footer";
import { TmProspectDashboard } from "../tm-prospect-dashboard/tm-prospect-dashboard";

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
  /**
   * Next upcoming webinar event (resolved server-side at /api/p/:token).
   * Null when no upcoming event is seeded. Threaded through to the
   * dashboard so Section 6's Countdown can render a real ticking
   * countdown to scheduledFor. Chat #115.
   */
  nextEvent?: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
  /**
   * Master-content-resolved copy for the prospect surfaces (TASK-147
   * inherit-com), resolved + interpolated server-side. Threaded to the
   * presentation hero (baVoiceCopy) and forwarded to the dashboard so its
   * six sections render Kevin's overrides. Optional/null-tolerant — every
   * consumer falls back to its built-in copy when absent.
   */
  copy?: ComProspectCopy | null;
}

export interface VideoCompletePlacement {
  positionNumber: number;
  placedAt: string;
}

// Which surface the prospect is viewing. Driven by the ?view= URL param;
// 'dashboard' is only honored once placement exists (see useEffect below).
type SurfaceView = "presentation" | "dashboard";
const VIEW_PARAM = "view";

// ---------------------------------------------------------------
// Composer
// ---------------------------------------------------------------

export interface TmVideoPresentationProps {
  resolved: ResolveTokenResponse;
}

export function TmVideoPresentation({ resolved }: TmVideoPresentationProps) {
  const { token, prospectFirstName, baFullName } = resolved;
  const nextEvent = resolved.nextEvent ?? null;
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

  // Placement captured on video_complete server response. Pre-hydrated
  // when the prospect returns to an already-completed token (Branch 1).
  const [placement, setPlacement] = useState<VideoCompletePlacement | null>(
    resolved.state === "video_complete" &&
      resolved.positionNumber !== undefined &&
      resolved.placedAt !== undefined
      ? { positionNumber: resolved.positionNumber, placedAt: resolved.placedAt }
      : null
  );

  // ---- Presentation <-> dashboard view (Chat #126) -------------
  // The view is a URL-param-backed piece of state so the prospect's
  // choice of surface is bookmarkable, shareable, and survives refresh.
  // Placement is decoupled from navigation: completing the video sets
  // `placement` (which makes the dashboard REACHABLE) but does NOT flip
  // the view — the prospect stays on the presentation until they act.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView: SurfaceView =
    searchParams.get(VIEW_PARAM) === "dashboard" ? "dashboard" : "presentation";

  // The dashboard view is only honored once placement exists. A
  // ?view=dashboard arriving before completion (e.g. a shared/bookmarked
  // link the prospect opens fresh) silently falls back to the
  // presentation; once they finish the video, the same URL resolves to
  // the dashboard. We never render the team line without a position.
  const view: SurfaceView =
    requestedView === "dashboard" && placement ? "dashboard" : "presentation";

  // If a stale ?view=dashboard is in the URL but we can't honor it yet,
  // strip it so the address bar reflects the surface actually shown.
  // (Avoids a confusing bookmarked-but-not-yet-placed state.)
  useEffect(() => {
    if (requestedView === "dashboard" && !placement) {
      const next = new URLSearchParams(searchParams);
      next.delete(VIEW_PARAM);
      setSearchParams(next, { replace: true });
    }
  }, [requestedView, placement, searchParams, setSearchParams]);

  const goToDashboard = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set(VIEW_PARAM, "dashboard");
    setSearchParams(next);
    // Crossing surfaces — start the new surface at the top.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [searchParams, setSearchParams]);

  const goToPresentation = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(VIEW_PARAM);
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [searchParams, setSearchParams]);

  // Callback passed to Section 3. Section 3 calls postVideoEvent and
  // on successful response calls this. Server is idempotent; client-
  // side dedup happens via firedMilestones for cleaner UX.
  //
  // Chat #126: completion sets `placement` (making the dashboard
  // reachable) but does NOT navigate. The prospect keeps reading; they
  // cross to the dashboard from the WhatsNext closer when they choose.
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
  // Dashboard only when the prospect has chosen it AND placement exists.
  if (view === "dashboard" && placement) {
    return (
      <TmProspectDashboard
        token={token}
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        positionNumber={placement.positionNumber}
        placedAt={placement.placedAt}
        nextEvent={nextEvent}
        copy={resolved.copy ?? null}
        onBackToPresentation={goToPresentation}
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
        baVoiceCopy={resolved.copy?.heroBaVoiceCopy ?? undefined}
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
      <Leadership />
      <WhatsNext baFirstName={baFirstName} onSeeTeam={goToDashboard} />
      <Footer baFullName={baFullName} />

      <ShellStyles />
    </main>
  );
}

// ---------------------------------------------------------------
// Dashboard branch is delegated to <TmProspectDashboard/> (Chat #113).
// The placeholder component that previously lived here has been
// removed in favor of the real six-section dashboard port.
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// Shell styles — ink + atmosphere + section transitions
// ---------------------------------------------------------------

function ShellStyles() {
  return <style>{shellCss}</style>;
}

const shellCss = `
  .tm-video-presentation {
    position: relative;
    min-height: 100svh;
    background: #0A0A0A;
    color: #F5EFE6;
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow-x: hidden;
  }
  /* Push the page content down to make room for the fixed ticker. */
  .tm-video-presentation { padding-top: 36px; }

  .tm-video-presentation::before {
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
  .tm-video-presentation::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.96 0 0 0 0 0.93 0 0 0 0 0.85 0 0 0 0.04 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>");
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
  }
  .tm-video-presentation > * {
    position: relative;
    z-index: 2;
  }
`;

export default TmVideoPresentation;

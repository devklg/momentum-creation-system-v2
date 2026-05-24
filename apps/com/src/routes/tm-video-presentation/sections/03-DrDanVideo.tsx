/**
 * tm-video-presentation / Section 3 — Dr. Dan's Video
 *
 * The keystone section. The video is the foundation; everything else
 * on the page is supporting material (COM Design B.1 Part 1).
 *
 * Locked sources:
 *   • COM Design B.1 "Part 1 — Watch Dr. Dan"
 *     - Eyebrow (mono): "Part 1 — The Product"
 *     - Headline: "Watch Dr. Dan. Then Everything Makes Sense."
 *     - 16:9 embedded YouTube iframe
 *   • COM Design B.1 "Part 3 — Science" — Dr. Dan credentials
 *     - Chief Scientific Officer and Chief Formulator
 *     - Caltech PhD in Organic Chemistry, 16 patents, 70+ supplements
 *       formulated, 1.3M followers, top-50 podcast
 *     - DOES NOT name his employer (locked-spec Part 3.8 — no THREE
 *       branding on .com)
 *   • Handoff Section 3 — caption below: "Then scroll. The rest of this
 *     page expands on what he just told you."
 *   • Chat #105 / Chat #106 — video event contract:
 *       POST /api/p/:token/video-event { kind }
 *       kinds: started | quarter | half | three_quarter | complete
 *       Server is idempotent (forward-only state machine).
 *       Client-side dedup via firedMilestones Set.
 *       complete fires on YT.PlayerState.ENDED OR currentTime >= 0.95 * duration.
 *   • App Description §3 + Chat #84 — video URL is the existing
 *     GLP-THREE video: https://www.youtube.com/embed/89wRvqx1d8M
 *
 * Compliance (locked-spec Part 3.8 / COM Design G.5):
 *   • Dr. Dan's employer is NOT named on .com
 *   • No income claims, no comp language, no THREE branding
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  VideoEventKind,
  VideoCompletePlacement,
} from "../tm-video-presentation";

// react-youtube types — minimal local shape so this file is self-contained.
// Use `import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube"`
// from the actual package in the build.
type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  /**
   * Seek to a position in the video (in seconds). When allowSeekAhead is
   * true, the player issues a new request to the server for the new
   * playhead position; when false, the player only seeks within already-
   * buffered video. We pass true for return-visit resumes.
   */
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
};
type YTStateChangeEvent = { data: number; target: YTPlayer };

// YT.PlayerState constants — same values the YouTube IFrame API ships.
const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

const VIDEO_ID = "89wRvqx1d8M";

/**
 * Return-visit resume map (Chat #115). When a prospect returns mid-video,
 * the composer hydrates firedMilestones from the server's recorded state.
 * On YT.Player ready we seek to a position just past the highest fired
 * milestone so the prospect picks up where they left off without
 * re-watching content they've already seen.
 *
 * Fractions are intentionally a hair past each milestone threshold so
 * the poll loop's >= check does NOT re-fire the milestone (no-op on
 * the server, but generates noise in logs).
 *
 * - started        → don't seek (start at 0; they pressed play but
 *                    haven't really watched anything yet)
 * - quarter        → 0.26 (just past 25%)
 * - half           → 0.51 (just past 50%)
 * - three_quarter  → 0.76 (just past 75%)
 * - complete       → not reached here — the composer routes a complete
 *                    token to the dashboard branch, this section
 *                    doesn't render. Listed for completeness.
 */
const RESUME_FRACTION: Record<VideoEventKind, number | null> = {
  started: null,
  quarter: 0.26,
  half: 0.51,
  three_quarter: 0.76,
  complete: null,
};

/**
 * Pick the resume fraction for the highest fired milestone in the set.
 * Returns null when no resume is needed (empty set, only 'started'
 * fired, or 'complete' — the dashboard branch case).
 */
function pickResumeFraction(fired: Set<VideoEventKind>): number | null {
  // Order matters — check from highest to lowest so we resume at the
  // furthest-along milestone.
  const order: VideoEventKind[] = ['three_quarter', 'half', 'quarter'];
  for (const kind of order) {
    if (fired.has(kind)) {
      const f = RESUME_FRACTION[kind];
      if (f !== null) return f;
    }
  }
  return null;
}

export interface DrDanVideoProps {
  token: string;
  /**
   * Fired by the component when a milestone successfully posts to the
   * server AND was not already in the fired set. For `complete`, the
   * component also passes the placement payload it received from the
   * server's response.
   */
  onMilestone: (kind: VideoEventKind, placement?: VideoCompletePlacement) => void;
  /**
   * The set of milestones already fired (server-resolved on initial
   * load, then updated as the prospect watches). Used both for visual
   * progress and as the dedup guard.
   */
  firedMilestones: Set<VideoEventKind>;
}

export function DrDanVideo({
  token,
  onMilestone,
  firedMilestones,
}: DrDanVideoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const firedRef = useRef<Set<VideoEventKind>>(new Set(firedMilestones));

  const [ytApiReady, setYtApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Keep the imperative fired set in sync with the prop. The prop is
  // the source of truth for "what the server says is fired"; the ref
  // is what the polling closure reads to avoid stale-closure bugs.
  useEffect(() => {
    firedRef.current = new Set(firedMilestones);
  }, [firedMilestones]);

  // ---- Load the YouTube IFrame API once ------------------------
  useEffect(() => {
    // If the API is already loaded by another instance, skip.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.YT && w.YT.Player) {
      setYtApiReady(true);
      return;
    }
    if (!w.__tmYtApiLoading) {
      w.__tmYtApiLoading = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
    const prev = w.onYouTubeIframeAPIReady as undefined | (() => void);
    w.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      setYtApiReady(true);
    };
  }, []);

  // ---- Fire a milestone to the server --------------------------
  // Wrapped in useCallback so the polling effect's closure is stable.
  const fireMilestone = useCallback(
    async (kind: VideoEventKind) => {
      if (firedRef.current.has(kind)) return;
      // Optimistically add — server is idempotent, but we also want
      // to avoid in-flight double-fires from poll-tick races.
      firedRef.current.add(kind);

      try {
        // Lazy import keeps the section file decoupled from lib/api
        // shape changes and matches the page composer's import style.
        const { postVideoEvent } = await import("../../../lib/api");
        const result = await postVideoEvent(token, kind);
        if (result.ok) {
          if (kind === "complete") {
            const d = result.data;
            if (
              typeof d.positionNumber === "number" &&
              typeof d.placedAt === "string"
            ) {
              onMilestone(kind, {
                positionNumber: d.positionNumber,
                placedAt: d.placedAt,
              });
              return;
            }
          }
          onMilestone(kind);
        } else {
          // Server rejected (404/410/409/network). Roll back the
          // optimistic add so a retry on next poll-tick can fire.
          // The forward-only semantics on the server mean a stale
          // milestone won't double-place; safe to retry.
          firedRef.current.delete(kind);
          // eslint-disable-next-line no-console
          console.warn("[tm-video] milestone post failed", kind, result.error);
        }
      } catch (err) {
        firedRef.current.delete(kind);
        // eslint-disable-next-line no-console
        console.warn("[tm-video] milestone post threw", kind, err);
      }
    },
    [token, onMilestone]
  );

  // ---- Create the YT.Player once the API is ready -------------
  useEffect(() => {
    if (!ytApiReady || !containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.YT || !w.YT.Player) return;

    const node = containerRef.current;
    // Make sure the inner playerNode exists; YT replaces it.
    let inner = node.querySelector<HTMLDivElement>(".tm-drdan-video__yt");
    if (!inner) {
      inner = document.createElement("div");
      inner.className = "tm-drdan-video__yt";
      node.appendChild(inner);
    }

    const player = new w.YT.Player(inner, {
      videoId: VIDEO_ID,
      playerVars: {
        rel: 0,        // related videos from this channel only
        modestbranding: 1,
        playsinline: 1,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          // Chat #115 — return-visit resume. If the prospect has fired
          // any quarter/half/three_quarter milestones already, seek the
          // player to just past their highest milestone so they don't
          // re-watch what they've already seen. Duration may be 0
          // briefly right after onReady; retry up to 5 times at 200ms.
          const resumeFraction = pickResumeFraction(firedRef.current);
          if (resumeFraction === null) return;
          let attempts = 0;
          const trySeek = () => {
            attempts += 1;
            try {
              const dur = player.getDuration();
              if (dur && dur > 0) {
                player.seekTo(resumeFraction * dur, true);
                return;
              }
            } catch {
              // ignore — retry below
            }
            if (attempts < 5) {
              window.setTimeout(trySeek, 200);
            }
            // After 5 attempts duration is still 0; the prospect will
            // see the video start at 0 and have to scrub manually. Not
            // a hard failure — the page still works.
          };
          trySeek();
        },
        onStateChange: (e: YTStateChangeEvent) => {
          // The black loader overlay lifts as soon as the player is
          // PLAYING — this is a DISPLAY concern and must NOT be gated on
          // the milestone-dedup guard. On a return visit where 'started'
          // already fired (token state video_started+), the milestone
          // guard is already true; coupling hasStarted to it left the
          // overlay covering a playing video — audio but no picture
          // (Chat #125 fix).
          if (e.data === YT_PLAYER_STATE.PLAYING) {
            setHasStarted(true);
            // Fire 'started' only once — its own dedup guard, separate
            // from the overlay.
            if (!firedRef.current.has("started")) {
              void fireMilestone("started");
            }
          }
          // ENDED → fire `complete` (poll loop will catch the 95% case).
          if (e.data === YT_PLAYER_STATE.ENDED) {
            void fireMilestone("complete");
          }
        },
        onError: () => {
          // Silent — the player will surface its own UI. We do not
          // fire a server event here.
        },
      },
    });
    playerRef.current = player;

    return () => {
      try {
        // YT.Player provides destroy(), but it's not in our minimal type.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (player as any).destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [ytApiReady, fireMilestone]);

  // ---- Poll loop: 25 / 50 / 75 / 95% milestones ----------------
  useEffect(() => {
    if (!playerReady) return;
    const p = playerRef.current;
    if (!p) return;

    const tick = () => {
      try {
        const cur = p.getCurrentTime();
        const dur = p.getDuration();
        if (!dur || dur <= 0) return;
        const pct = cur / dur;
        if (pct >= 0.25 && !firedRef.current.has("quarter")) {
          void fireMilestone("quarter");
        }
        if (pct >= 0.5 && !firedRef.current.has("half")) {
          void fireMilestone("half");
        }
        if (pct >= 0.75 && !firedRef.current.has("three_quarter")) {
          void fireMilestone("three_quarter");
        }
        if (pct >= 0.95 && !firedRef.current.has("complete")) {
          void fireMilestone("complete");
        }
      } catch {
        /* player not ready, ignore tick */
      }
    };

    // 1s poll — accurate enough for milestone tracking, easy on the CPU.
    pollIntervalRef.current = window.setInterval(tick, 1000);
    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [playerReady, fireMilestone]);

  return (
    <section className="tm-drdan-video" id="dr-dan-video" aria-label="Dr. Dan's Video">
      <div className="tm-drdan-video__inner">
        <div className="tm-drdan-video__eyebrow">Part 1 — The Product</div>
        <h2 className="tm-drdan-video__headline">
          Watch Dr. Dan. Then Everything Makes Sense.
        </h2>

        {/* Dr. Dan credentials card. NO employer named, per locked-spec
            Part 3.8. The credentials speak for the science. */}
        <div className="tm-drdan-video__credentials">
          <div className="tm-drdan-video__credentials-name">
            Dr. Dan Gubler · Chief Scientific Officer &amp; Chief Formulator
          </div>
          <ul className="tm-drdan-video__credentials-list">
            <li>Caltech PhD in Organic Chemistry</li>
            <li>16 patents</li>
            <li>70+ supplements formulated</li>
            <li>1.3M followers</li>
            <li>Top-50 podcast</li>
          </ul>
        </div>

        {/* 16:9 video frame + loader */}
        <div className="tm-drdan-video__frame">
          <div
            ref={containerRef}
            className="tm-drdan-video__container"
            aria-label="Dr. Dan Gubler — GLP-THREE product video"
          />
          {(!playerReady || !hasStarted) && (
            <div className="tm-drdan-video__loader" aria-hidden="true">
              <CompassPulse />
              <div className="tm-drdan-video__loader-text">
                {playerReady ? "Press play" : "Loading video…"}
              </div>
            </div>
          )}
        </div>

        <p className="tm-drdan-video__caption">
          Then scroll. The rest of this page expands on what he just told you.
        </p>
      </div>
      <style>{styles}</style>
    </section>
  );
}

/**
 * Compass-rose pulse — same family as the Section 1 hero rose, scaled
 * down and tuned for use as a loader pip. Gold star points, teal center.
 */
function CompassPulse() {
  return (
    <svg
      className="tm-drdan-video__pulse"
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="54" fill="none" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.22"
        className="tm-drdan-video__pulse-ring" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.38" />
      <g stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round">
        <line x1="60" y1="14" x2="60" y2="38" />
        <line x1="60" y1="82" x2="60" y2="106" />
        <line x1="82" y1="60" x2="106" y2="60" />
        <line x1="14" y1="60" x2="38" y2="60" />
      </g>
      <circle cx="60" cy="60" r="4" fill="#2DD4BF" />
    </svg>
  );
}

const styles = `
  .tm-drdan-video {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    display: flex;
    justify-content: center;
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-drdan-video__inner {
    width: 100%;
    max-width: 1100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }

  .tm-drdan-video__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }

  .tm-drdan-video__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 72px);
    line-height: 1.04;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }

  /* ---- credentials card ------------------------------------------ */
  .tm-drdan-video__credentials {
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.18);
    border-radius: 4px;
    padding: clamp(18px, 2.4vw, 28px) clamp(20px, 3vw, 36px);
    max-width: 720px;
    width: 100%;
  }
  .tm-drdan-video__credentials-name {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 500;
    font-size: clamp(15px, 1.3vw, 18px);
    color: #F5EFE6;
    margin-bottom: 12px;
    letter-spacing: 0.01em;
  }
  .tm-drdan-video__credentials-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    justify-content: center;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.72);
  }
  .tm-drdan-video__credentials-list li {
    display: inline-flex;
    align-items: center;
  }
  .tm-drdan-video__credentials-list li + li::before {
    content: '·';
    color: rgba(201, 168, 76, 0.6);
    margin-right: 18px;
    margin-left: -10px;
  }

  /* ---- 16:9 frame + loader --------------------------------------- */
  .tm-drdan-video__frame {
    position: relative;
    width: 100%;
    max-width: 980px;
    aspect-ratio: 16 / 9;
    background: #0A0A0A;
    border: 1px solid rgba(201, 168, 76, 0.32);
    border-radius: 4px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(201, 168, 76, 0.08),
      0 24px 64px -16px rgba(0, 0, 0, 0.5);
  }
  .tm-drdan-video__container,
  .tm-drdan-video__container > iframe,
  .tm-drdan-video__yt,
  .tm-drdan-video__yt > iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .tm-drdan-video__loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: #0A0A0A;
    pointer-events: none;
    transition: opacity 400ms ease;
  }
  .tm-drdan-video__pulse {
    width: 56px;
    height: 56px;
    filter: drop-shadow(0 0 12px rgba(201, 168, 76, 0.32));
  }
  .tm-drdan-video__pulse-ring {
    transform-origin: 60px 60px;
    transform-box: fill-box;
    animation: tm-drdan-video-breath 2.4s ease-in-out infinite;
  }
  @keyframes tm-drdan-video-breath {
    0%, 100% { transform: scale(1);    stroke-opacity: 0.22; }
    50%      { transform: scale(1.08); stroke-opacity: 0.45; }
  }
  .tm-drdan-video__loader-text {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
  }

  .tm-drdan-video__caption {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-style: italic;
    font-size: clamp(14px, 1.2vw, 17px);
    line-height: 1.5;
    color: rgba(245, 239, 230, 0.62);
    margin: 0;
    max-width: 52ch;
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-drdan-video__pulse-ring { animation: none; }
  }
`;

export default DrDanVideo;

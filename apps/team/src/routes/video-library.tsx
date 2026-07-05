/**
 * /video-library — the ScriptMaker front door (Chat #123).
 *
 * Ported from D:/team-magnificent-training/video-library.html (the legacy
 * standalone page that linked OUT to YouTube with target=_blank and had NO
 * completion event). This .team port EMBEDS the players so a fire-on-finish
 * signal exists — the real build item per Chat #118. Mirrors the proven YT
 * IFrame state machine in apps/com/.../03-DrDanVideo.tsx (load API once via a
 * window flag, YT.Player, onStateChange started/ENDED, 1s poll for 95%).
 *
 * ScriptMaker role (Chat #118 lock): product-video-anchored. Each PRODUCT
 * video card carries a "Who can use this?" button, and finishing a product
 * video auto-prompts the same flow. The flow collects the prospect's first
 * name (+ optional context the BA knows), calls POST /api/scriptmaker/draft
 * for a compliance-clean product-anchored message, then hands the draft into
 * the existing /invitations form via router state (seed + source).
 *
 * BOUNDARY: ScriptMaker DRAFTS only — it never mints a token, creates a
 * prospect, or sends. The /invitations spine owns all of that (Chat #120).
 *
 * COMPLIANCE (locked-spec 3.11 + the #118 correction): the draft action is
 * exposed on PRODUCT videos only. The Comp Plan section renders as BA
 * education (watch-only) — drafting a prospect invitation off a binary
 * comp-plan video would pull income/comp framing into a prospect-facing
 * draft, which 3.10/3.11 forbid. `draftable: false` on those entries makes
 * the rule explicit in the data, not implicit in the layout.
 *
 * PALETTE: the legacy page used an orange #D4601A accent that is NOT in the
 * locked five-color palette. This port drops it to teal/gold (same cleanup
 * as the #100 10-steps port). The visible brand chrome remains Team
 * Magnificent only; product-company facts stay in product/training
 * content where they are functional.
 *
 * .team convention (lesson chat120): wire types are declared locally rather
 * than imported from @momentum/shared, whose `src` alias sits outside this
 * app's rootDir and trips TS6059. The server is the source of truth
 * (packages/shared/src/types.ts: LibraryVideo / ScriptMakerDraftPayload /
 * ScriptMakerDraftResponse / InvitationSource).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ───────────────────────────────────────────────────────────────────────
// Local wire contracts (.team convention — see header)
// ───────────────────────────────────────────────────────────────────────

type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

/** POST /api/scriptmaker/draft request body. */
interface ScriptMakerDraftPayload {
  productName: string;
  videoTitle: string;
  prospectFirstName: string;
  prospectContext?: string | null;
}

/** POST /api/scriptmaker/draft 200 response. */
interface ScriptMakerDraftResponse {
  ok: true;
  draft: string;
  productName: string;
  prospectFirstName: string;
  degraded: boolean;
}

/**
 * The seed shape /invitations reads from router state (Chat #123 seam).
 * Mirrors the ProspectForm partial the page pre-fills from. Only the fields
 * ScriptMaker can know are filled; the BA completes city/state on arrival.
 */
interface InvitationSeedState {
  seed: {
    firstName?: string;
    message?: string;
  };
  source: InvitationSource;
}

// ───────────────────────────────────────────────────────────────────────
// Catalog
// ───────────────────────────────────────────────────────────────────────
//
// A curated subset of the legacy catalog — the full-length, share-worthy
// product videos a BA would actually anchor an invitation to. Shorts and the
// 28-video product playlist remain accessible via the legacy library; this
// surface focuses on the videos that drive the draft flow. `draftable` is the
// compliance gate: PRODUCT videos true, comp-plan video false.

type LibKind = 'full' | 'short' | 'deep_dive';

interface LibVideo {
  videoId: string;
  youtubeId: string;
  title: string;
  productName: string;
  blurb: string;
  duration: string;
  kind: LibKind;
  featured: boolean;
  /** Whether ScriptMaker may anchor a prospect draft to this video. */
  draftable: boolean;
}

interface LibSection {
  id: string;
  number: string;
  title: string;
  titleAccent: string;
  blurb: string;
  videos: LibVideo[];
  /** Comp-plan section is BA education only — no draft anywhere in it. */
  education: boolean;
}

const SECTIONS: LibSection[] = [
  {
    id: 'glp-three',
    number: '01',
    title: 'GLP',
    titleAccent: 'THREE',
    blurb:
      'Full presentations and testimonials. Watch one, then share it with someone you know who has been looking for a natural way in.',
    education: false,
    videos: [
      {
        videoId: 'glp3-launch',
        youtubeId: '1IZiV7RXdCY',
        title: 'GLP THREE Launch Webinar with Dr. Dan Gubler',
        productName: 'GLP-THREE',
        blurb: 'Foundation video — the full launch presentation.',
        duration: '16:18',
        kind: 'full',
        featured: true,
        draftable: true,
      },
      {
        videoId: 'glp3-all-things',
        youtubeId: 'jGG1nSu9s94',
        title: 'All Things GLP THREE',
        productName: 'GLP-THREE',
        blurb: 'Complete overview — the science and the results in one.',
        duration: '17:56',
        kind: 'full',
        featured: true,
        draftable: true,
      },
      {
        videoId: 'glp3-this-is-me',
        youtubeId: 'LzvuaVb2E2M',
        title: 'This is Me and GLP THREE',
        productName: 'GLP-THREE',
        blurb: 'A personal testimony — short and very shareable.',
        duration: '1:05',
        kind: 'short',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'glp3-results',
        youtubeId: 'kw2m-vrj_dI',
        title: 'Results Are In | GLP THREE',
        productName: 'GLP-THREE',
        blurb: 'Real results, social-share ready.',
        duration: '0:53',
        kind: 'short',
        featured: false,
        draftable: true,
      },
    ],
  },
  {
    id: 'product-line',
    number: '02',
    title: 'Full',
    titleAccent: 'Product Line',
    blurb:
      'Dr. Dan walks through the rest of the catalogue. Anchor an invitation to whichever product fits the person you have in mind.',
    education: false,
    videos: [
      {
        videoId: 'prod-all-three',
        youtubeId: 'dEO_A-Q5pTE',
        title: 'All THREE Products — with Dr. Dan',
        productName: 'the THREE product line',
        blurb: 'The entire product line — great for a broad introduction.',
        duration: '16:56',
        kind: 'full',
        featured: true,
        draftable: true,
      },
      {
        videoId: 'prod-visage',
        youtubeId: 'VlK-Jr9a9aI',
        title: 'Dr. Dan on VISAGE',
        productName: 'VISAGE',
        blurb: 'The skin collection — science breakdown.',
        duration: '5:20',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-vitalite',
        youtubeId: 'c5HHW-cwbyo',
        title: 'Dr. Dan on Vitalit\u00e9',
        productName: 'Vitalit\u00e9',
        blurb: 'Energy and vitality.',
        duration: '3:15',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-revive',
        youtubeId: '21TspVJ98ic',
        title: 'Dr. Dan on Rev\u00edve',
        productName: 'Rev\u00edve',
        blurb: 'Recovery and renewal.',
        duration: '2:26',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-collagene',
        youtubeId: 'z-gf-uGGdJw',
        title: 'Dr. Dan on Collag\u00e8ne',
        productName: 'Collag\u00e8ne',
        blurb: 'Collagen and skin health.',
        duration: '2:51',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-imune',
        youtubeId: 'QaCFdqb09rk',
        title: 'Dr. Dan on Im\u00fane',
        productName: 'Im\u00fane',
        blurb: 'Immune support.',
        duration: '3:22',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-purifi',
        youtubeId: 'Ir5sybkR950',
        title: 'Dr. Dan on Purif\u00ed',
        productName: 'Purif\u00ed',
        blurb: 'Detox and cleanse.',
        duration: '2:31',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
      {
        videoId: 'prod-eternel',
        youtubeId: '7kwgxsFDkQ8',
        title: 'Dr. Dan on \u00c9ternel',
        productName: '\u00c9ternel',
        blurb: 'Anti-aging and longevity.',
        duration: '2:36',
        kind: 'deep_dive',
        featured: false,
        draftable: true,
      },
    ],
  },
  {
    id: 'compensation',
    number: '03',
    title: 'Compensation',
    titleAccent: 'Plan',
    blurb:
      'For your own training. These explain the binary comp plan and how to build — watch them to learn, not to share. ScriptMaker stays off this section: a prospect invitation never carries comp or income framing.',
    education: true,
    videos: [
      {
        videoId: 'comp-explode',
        youtubeId: '',
        title:
          'How to Use GLP THREE to Explode Your Business & Create a Huge Financial Success Story',
        productName: 'the comp plan',
        blurb: 'Comp plan explanation · binary system · fast start.',
        duration: '—',
        kind: 'full',
        featured: true,
        draftable: false,
      },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────
// YouTube IFrame API — shared loader + minimal player type
// ───────────────────────────────────────────────────────────────────────

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
};
type YTStateChangeEvent = { data: number; target: YTPlayer };

const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** Load the YouTube IFrame API once across all card players. */
function useYouTubeApi(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.YT && w.YT.Player) {
      setReady(true);
      return;
    }
    if (!w.__tmYtApiLoading) {
      w.__tmYtApiLoading = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
    const prev = w.onYouTubeIframeAPIReady as undefined | (() => void);
    w.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      setReady(true);
    };
  }, []);
  return ready;
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

/** The video a draft is being composed for, when the modal is open. */
interface DraftTarget {
  productName: string;
  videoTitle: string;
  /** 'finish' = auto-prompt on completion; 'button' = explicit tap. */
  trigger: 'finish' | 'button';
}

export function VideoLibraryPage() {
  const navigate = useNavigate();
  const ytReady = useYouTubeApi();
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);

  const openDraft = useCallback((video: LibVideo, trigger: 'finish' | 'button') => {
    if (!video.draftable) return;
    setDraftTarget({
      productName: video.productName,
      videoTitle: video.title,
      trigger,
    });
  }, []);

  const closeDraft = useCallback(() => setDraftTarget(null), []);

  /**
   * On a successful draft, hand it to /invitations via router state
   * (Chat #123 seam). The page reads location.state, pre-fills the form,
   * and stamps source='scriptmaker'. ScriptMaker proposes; the BA disposes.
   */
  const handleDraftReady = useCallback(
    (prospectFirstName: string, draft: string) => {
      const state: InvitationSeedState = {
        seed: { firstName: prospectFirstName, message: draft },
        source: 'scriptmaker',
      };
      navigate('/invitations', { state });
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-ink text-cream">
      {/* Hero */}
      <header className="relative overflow-hidden px-6 pt-20 pb-16 text-center">
        <p className="font-mono tracking-wide2 text-[11px] text-teal uppercase mb-4">
          Team Magnificent
        </p>
        <h1 className="font-display text-[clamp(48px,9vw,96px)] leading-[0.9] text-cream">
          Know your <span className="text-gold-bright">product.</span>
          <br />
          <span className="text-teal">Win your</span> market.
        </h1>
        <p className="font-display text-[clamp(20px,3vw,30px)] tracking-[0.08em] text-gold mt-4">
          Official Video Resource Library
        </p>
        <p className="max-w-2xl mx-auto text-cream-mute text-[16px] leading-[1.7] mt-6">
          Watch a product video, then turn it into an invitation in one tap.
          ScriptMaker drafts a personal note anchored to what you just watched
          — you review it, edit it, and send it from your own phone.
        </p>
      </header>

      {/* Sections */}
      <main className="max-w-6xl mx-auto px-6 pb-24">
        {SECTIONS.map((section) => (
          <LibrarySection
            key={section.id}
            section={section}
            ytReady={ytReady}
            onDraft={openDraft}
          />
        ))}
      </main>

      {/* Draft modal */}
      {draftTarget && (
        <DraftModal
          target={draftTarget}
          onClose={closeDraft}
          onDraftReady={handleDraftReady}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section
// ───────────────────────────────────────────────────────────────────────

function LibrarySection({
  section,
  ytReady,
  onDraft,
}: {
  section: LibSection;
  ytReady: boolean;
  onDraft: (video: LibVideo, trigger: DraftTarget['trigger']) => void;
}) {
  const count = section.videos.length;
  return (
    <section id={section.id} className="mb-20">
      <div className="flex items-baseline gap-4 border-b border-line pb-5 mb-8">
        <span className="font-mono text-[12px] text-teal tracking-[0.1em]">
          {section.number}
        </span>
        <h2 className="font-display text-[clamp(28px,4vw,40px)] tracking-[0.04em] text-cream flex-1">
          {section.title} <span className="text-gold-bright">{section.titleAccent}</span>
        </h2>
        <span className="font-mono text-[11px] text-cream-faint tracking-[0.1em]">
          {count} {count === 1 ? 'Video' : 'Videos'}
        </span>
      </div>

      <p className="text-cream-mute text-[15px] leading-[1.7] max-w-3xl mb-8">
        {section.blurb}
      </p>

      {section.education && (
        <div className="mb-8 inline-flex items-center gap-2 bg-gold/[0.06] border border-gold/25 rounded-md py-2 px-3.5">
          <span className="h-2 w-2 rounded-full bg-gold" />
          <span className="font-mono text-[11px] tracking-[0.12em] text-gold uppercase">
            For your training — watch only, not for sharing
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {section.videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            ytReady={ytReady}
            onDraft={onDraft}
          />
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Video card — embedded player + fire-on-finish + draft button
// ───────────────────────────────────────────────────────────────────────

const KIND_BADGE: Record<LibKind, string> = {
  full: 'Full',
  short: 'Short',
  deep_dive: 'Deep Dive',
};

function VideoCard({
  video,
  ytReady,
  onDraft,
}: {
  video: LibVideo;
  ytReady: boolean;
  onDraft: (video: LibVideo, trigger: DraftTarget['trigger']) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const [playerReady, setPlayerReady] = useState(false);
  const [finished, setFinished] = useState(false);

  const hasEmbed = video.youtubeId.trim() !== '';

  // Fire once when the prospect-less BA finishes the product video. Only
  // draftable videos auto-prompt; comp-plan (draftable:false) never does.
  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    if (video.draftable) onDraft(video, 'finish');
  }, [video, onDraft]);

  // Create the player once the API + container are ready.
  useEffect(() => {
    if (!ytReady || !hasEmbed || !containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.YT || !w.YT.Player) return;

    const node = containerRef.current;
    let inner = node.querySelector<HTMLDivElement>('.tm-vl__yt');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'tm-vl__yt';
      node.appendChild(inner);
    }

    const player = new w.YT.Player(inner, {
      videoId: video.youtubeId,
      playerVars: {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      events: {
        onReady: () => setPlayerReady(true),
        onStateChange: (e: YTStateChangeEvent) => {
          if (e.data === YT_PLAYER_STATE.ENDED) handleFinish();
        },
      },
    });
    playerRef.current = player;

    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (player as any).destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [ytReady, hasEmbed, video.youtubeId, handleFinish]);

  // Poll for the 95% completion case (ENDED doesn't always fire if the
  // BA scrubs to the end). Mirrors 03-DrDanVideo.tsx — 1s tick.
  useEffect(() => {
    if (!playerReady) return;
    const p = playerRef.current;
    if (!p) return;
    const tick = () => {
      try {
        const cur = p.getCurrentTime();
        const dur = p.getDuration();
        if (!dur || dur <= 0) return;
        if (cur / dur >= 0.95) handleFinish();
      } catch {
        /* not ready */
      }
    };
    pollRef.current = window.setInterval(tick, 1000);
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [playerReady, handleFinish]);

  return (
    <div
      className={
        'bg-ink-2 border rounded-md overflow-hidden flex flex-col transition-colors ' +
        (video.featured ? 'border-gold/40' : 'border-line')
      }
    >
      {/* 16:9 player frame */}
      <div className="relative aspect-video bg-ink">
        {hasEmbed ? (
          <div
            ref={containerRef}
            className="tm-vl__frame absolute inset-0"
            aria-label={video.title}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] tracking-[0.12em] text-cream-faint uppercase">
              Plays in your training portal
            </span>
          </div>
        )}
        {hasEmbed && !playerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink pointer-events-none">
            <span className="font-mono text-[11px] tracking-[0.18em] text-cream-faint uppercase">
              Loading\u2026
            </span>
          </div>
        )}
        <span className="absolute top-2 left-2 font-mono text-[10px] tracking-[0.1em] uppercase text-teal bg-ink/80 border border-teal/30 rounded-sm py-0.5 px-1.5">
          {KIND_BADGE[video.kind]}
        </span>
        {video.duration !== '—' && (
          <span className="absolute bottom-2 right-2 font-mono text-[11px] text-cream bg-ink/85 rounded-sm py-0.5 px-1.5">
            {video.duration}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {video.featured && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-gold w-fit">
            ★ Featured
          </span>
        )}
        <h3 className="text-cream text-[15px] font-medium leading-[1.4]">
          {video.title}
        </h3>
        <p className="text-cream-faint text-[13px] leading-[1.5]">{video.blurb}</p>

        {/* Draft action — product videos only */}
        {video.draftable ? (
          <div className="mt-auto pt-3">
            {finished && (
              <p className="font-mono text-[10px] tracking-[0.1em] text-teal uppercase mb-2">
                Finished — who do you know?
              </p>
            )}
            <Button
              onClick={() => onDraft(video, 'button')}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4"
            >
              Who can use this?
            </Button>
          </div>
        ) : (
          <div className="mt-auto pt-3">
            <span className="font-mono text-[10px] tracking-[0.1em] text-cream-faint uppercase">
              Training video — no prospect draft
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Draft modal — collect prospect name + context, call ScriptMaker
// ───────────────────────────────────────────────────────────────────────

function DraftModal({
  target,
  onClose,
  onDraftReady,
}: {
  target: DraftTarget;
  onClose: () => void;
  onDraftReady: (prospectFirstName: string, draft: string) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = firstName.trim() !== '' && !submitting;
  const intro =
    target.trigger === 'finish'
      ? 'That video is done. Name one person who came to mind while you watched.'
      : 'Name one person who came to mind while you watched.';

  const handleDraft = useCallback(async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const payload: ScriptMakerDraftPayload = {
      productName: target.productName,
      videoTitle: target.videoTitle,
      prospectFirstName: firstName.trim(),
      prospectContext: context.trim() || null,
    };
    try {
      const res = await fetch('/api/scriptmaker/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | ScriptMakerDraftResponse
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not draft that. Try again.');
        return;
      }
      onDraftReady(payload.prospectFirstName, data.draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setError(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [ready, target, firstName, context, onDraftReady]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-ink-2 border border-gold/30 rounded-lg p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono tracking-[0.18em] text-[11px] text-teal uppercase mb-2">
          ScriptMaker · {target.productName}
        </p>
        <h2 className="font-display text-[clamp(28px,5vw,40px)] leading-[0.98] text-cream mb-3">
          Who do you know?
        </h2>
        <p className="text-cream-mute text-[14px] leading-[1.6] mb-6">
          {intro} ScriptMaker will draft a personal note about{' '}
          <span className="text-cream">{target.productName}</span> — you&rsquo;ll
          review and edit it on the next screen before anything is sent.
        </p>

        <div className="space-y-3.5">
          <div>
            <Label htmlFor="sm-first">Their first name</Label>
            <Input
              id="sm-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder="e.g. Marcus"
            />
          </div>
          <div>
            <Label htmlFor="sm-context">
              Anything you know about them{' '}
              <span className="text-cream-faint normal-case">(optional)</span>
            </Label>
            <textarea
              id="sm-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="e.g. asked me about Ozempic, wants something natural"
              className={
                'w-full bg-ink border border-line text-cream rounded-md ' +
                'px-3.5 py-3 text-sm font-body leading-[1.55] ' +
                'placeholder:text-cream/30 ' +
                'focus:outline-none focus:border-gold transition-colors resize-y'
              }
            />
            <p className="mt-1.5 text-[11px] font-mono tracking-[0.06em] text-cream-faint">
              {context.length}/600
            </p>
          </div>

          {error && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={handleDraft}
              disabled={!ready}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-7 py-5"
            >
              {submitting ? 'Drafting\u2026' : 'Draft the invitation'}
            </Button>
            <Button
              onClick={onClose}
              className="bg-transparent text-cream border border-cream/20 hover:bg-cream/[0.05] font-mono tracking-[0.04em] text-[13px] px-6 py-5"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoLibraryPage;

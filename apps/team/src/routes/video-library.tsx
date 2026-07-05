/**
 * /video-library — Product Gallery.
 *
 * Brief 9 converts the old hardcoded ScriptMaker catalog into the
 * tmag_content_videos content model. The page still embeds YouTube players so
 * product-video completion can open the same ScriptMaker draft flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type InvitationSource = 'self' | 'ivory' | 'scriptmaker';
type ContentVideoAudience = 'member' | 'prospect' | 'both';

interface ContentVideo {
  contentVideoId: string;
  section: string;
  title: string;
  youtubeId: string | null;
  url: string | null;
  description: string;
  sortOrder: number;
  audience: ContentVideoAudience;
  active: boolean;
}

interface ContentVideoSection {
  section: string;
  videos: ContentVideo[];
}

interface ContentVideosResponse {
  ok: true;
  sections: ContentVideoSection[];
}

interface ScriptMakerDraftPayload {
  productName: string;
  videoTitle: string;
  prospectFirstName: string;
  prospectContext?: string | null;
}

interface ScriptMakerDraftResponse {
  ok: true;
  draft: string;
  productName: string;
  prospectFirstName: string;
  degraded: boolean;
}

interface InvitationSeedState {
  seed: {
    firstName?: string;
    message?: string;
  };
  source: InvitationSource;
}

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
};
type YTStateChangeEvent = { data: number; target: YTPlayer };

const YT_PLAYER_STATE = { ENDED: 0 } as const;

function useYouTubeApi(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.YT?.Player) {
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

interface DraftTarget {
  productName: string;
  videoTitle: string;
  trigger: 'finish' | 'button';
}

export function VideoLibraryPage() {
  const navigate = useNavigate();
  const ytReady = useYouTubeApi();
  const [sections, setSections] = useState<ContentVideoSection[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/content/videos', { credentials: 'include' });
        const data = (await res.json()) as ContentVideosResponse | { ok: false };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setState('error');
          return;
        }
        setSections(data.sections);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDraft = useCallback((video: ContentVideo, trigger: DraftTarget['trigger']) => {
    if (!canDraft(video)) return;
    setDraftTarget({
      productName: productNameFor(video),
      videoTitle: video.title,
      trigger,
    });
  }, []);

  const handleDraftReady = useCallback(
    (prospectFirstName: string, draft: string) => {
      const routeState: InvitationSeedState = {
        seed: { firstName: prospectFirstName, message: draft },
        source: 'scriptmaker',
      };
      navigate('/invitations', { state: routeState });
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="px-6 md:px-10 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
          <Link
            to="/cockpit"
            className="font-display tracking-[0.18em] text-[15px] text-gold hover:opacity-80"
          >
            TEAM MAGNIFICENT
          </Link>
        </div>
        <Link
          to="/cockpit"
          className="font-mono tracking-[0.22em] text-[10px] text-cream-mute hover:text-gold uppercase"
        >
          ← Cockpit
        </Link>
      </header>

      <section className="px-6 pt-12 pb-12 text-center border-b border-line">
        <p className="font-mono tracking-[0.28em] text-[10px] text-teal uppercase mb-4">
          Product Gallery
        </p>
        <h1 className="font-display text-[clamp(46px,8vw,88px)] leading-[0.92] text-cream">
          Know the product.
          <br />
          <span className="text-gold-bright">Share with confidence.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-cream-mute text-[16px] leading-[1.7] mt-6">
          Kevin can update this gallery from /admin. Watch product videos here,
          then turn the right one into a personal invitation when someone comes to mind.
        </p>
      </section>

      <main className="max-w-6xl mx-auto px-6 py-14">
        {state === 'loading' && (
          <p className="font-mono tracking-[0.12em] text-[12px] text-cream-faint uppercase">
            Loading Product Gallery...
          </p>
        )}
        {state === 'error' && (
          <div className="border border-red-400/30 bg-red-500/[0.04] rounded-md p-5">
            <p className="font-mono tracking-[0.08em] text-[12px] text-red-300 uppercase">
              Product Gallery could not load.
            </p>
          </div>
        )}
        {state === 'ready' && sections.length === 0 && (
          <div className="border border-line rounded-md p-6">
            <p className="text-cream-mute text-[14px]">
              No gallery videos are active yet. Kevin can add them from /admin.
            </p>
          </div>
        )}
        {state === 'ready' &&
          sections.map((section, index) => (
            <LibrarySection
              key={section.section}
              section={section}
              number={String(index + 1).padStart(2, '0')}
              ytReady={ytReady}
              onDraft={openDraft}
            />
          ))}
      </main>

      {draftTarget && (
        <DraftModal
          target={draftTarget}
          onClose={() => setDraftTarget(null)}
          onDraftReady={handleDraftReady}
        />
      )}
    </div>
  );
}

function LibrarySection({
  section,
  number,
  ytReady,
  onDraft,
}: {
  section: ContentVideoSection;
  number: string;
  ytReady: boolean;
  onDraft: (video: ContentVideo, trigger: DraftTarget['trigger']) => void;
}) {
  return (
    <section className="mb-16 scroll-mt-8">
      <div className="flex items-baseline gap-4 border-b border-line pb-5 mb-8">
        <span className="font-mono text-[12px] text-teal tracking-[0.1em]">
          {number}
        </span>
        <h2 className="font-display text-[clamp(28px,4vw,42px)] tracking-[0.04em] text-cream flex-1">
          {section.section}
        </h2>
        <span className="font-mono text-[11px] text-cream-faint tracking-[0.1em]">
          {section.videos.length} {section.videos.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      {section.section.toLowerCase().includes('product knowledge') && (
        <p className="text-cream-mute text-[15px] leading-[1.7] max-w-3xl mb-8">
          Product Knowledge is the Fast Start bridge: use this section to go deeper
          on the product story after Module 1.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {section.videos.map((video) => (
          <VideoCard
            key={video.contentVideoId}
            video={video}
            ytReady={ytReady}
            onDraft={onDraft}
          />
        ))}
      </div>
    </section>
  );
}

function VideoCard({
  video,
  ytReady,
  onDraft,
}: {
  video: ContentVideo;
  ytReady: boolean;
  onDraft: (video: ContentVideo, trigger: DraftTarget['trigger']) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [finished, setFinished] = useState(false);

  const draftable = canDraft(video);
  const hasEmbed = !!video.youtubeId;

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    if (draftable) onDraft(video, 'finish');
  }, [draftable, onDraft, video]);

  useEffect(() => {
    if (!ytReady || !hasEmbed || !containerRef.current || !video.youtubeId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.YT?.Player) return;

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

  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;
    pollRef.current = window.setInterval(() => {
      try {
        const duration = player.getDuration();
        if (duration > 0 && player.getCurrentTime() / duration >= 0.95) {
          handleFinish();
        }
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [playerReady, handleFinish]);

  return (
    <div className="bg-ink-2 border border-line rounded-md overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-ink">
        {hasEmbed ? (
          <div
            ref={containerRef}
            className="tm-vl__frame absolute inset-0"
            aria-label={video.title}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ExternalLink className="h-8 w-8 text-gold" aria-hidden="true" />
          </div>
        )}
        {hasEmbed && !playerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink pointer-events-none">
            <span className="font-mono text-[11px] tracking-[0.18em] text-cream-faint uppercase">
              Loading...
            </span>
          </div>
        )}
        <span className="absolute top-2 left-2 font-mono text-[10px] tracking-[0.1em] uppercase text-teal bg-ink/80 border border-teal/30 rounded-sm py-0.5 px-1.5">
          {video.audience === 'member' ? 'Training' : video.audience === 'prospect' ? 'Shareable' : 'Training + Shareable'}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-cream text-[15px] font-medium leading-[1.4]">
          {video.title}
        </h3>
        <p className="text-cream-faint text-[13px] leading-[1.5]">
          {video.description}
        </p>

        <div className="mt-auto pt-3 flex flex-wrap gap-3 items-center">
          {draftable && (
            <Button
              onClick={() => onDraft(video, 'button')}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4"
            >
              {finished ? 'Who else can use this?' : 'Who can use this?'}
            </Button>
          )}
          {!draftable && video.url && (
            <a
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase hover:text-gold-bright"
            >
              Open resource -&gt;
            </a>
          )}
          {!draftable && !video.url && (
            <span className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase">
              Member training
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

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
          <span className="text-cream">{target.productName}</span>. You will
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
              placeholder="e.g. asked me about GLP-1s, wants something natural"
              className="w-full bg-ink border border-line text-cream rounded-md px-3.5 py-3 text-sm font-body leading-[1.55] placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors resize-y"
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
              {submitting ? 'Drafting...' : 'Draft the invitation'}
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

function canDraft(video: ContentVideo): boolean {
  if (!video.youtubeId) return false;
  if (video.audience === 'member') return false;
  return !video.section.toLowerCase().includes('compensation');
}

function productNameFor(video: ContentVideo): string {
  const section = video.section.replace(/^\d+\s*[.)-]?\s*/, '').trim();
  return section || video.title;
}

export default VideoLibraryPage;

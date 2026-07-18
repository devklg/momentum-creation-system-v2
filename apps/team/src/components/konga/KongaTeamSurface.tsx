import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { McsKongaTeamLeaderboardResponse } from '@momentum/shared';
import { KongaLineView } from '@momentum/konga-ui';
import { Expand, Minimize2 } from 'lucide-react';
import { useKongaTeamStream } from './useKongaTeamStream';
import './konga-team.css';

type LeaderboardState =
  | { kind: 'loading' }
  | { kind: 'ready'; value: McsKongaTeamLeaderboardResponse }
  | { kind: 'error' };

export function KongaTeamSurface() {
  const { loading, error, snapshot, stream } = useKongaTeamStream();
  const [leaderboard, setLeaderboard] = useState<LeaderboardState>({ kind: 'loading' });
  const [presenting, setPresenting] = useState(false);
  const presentationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/cockpit/konga/leaderboard', {
      credentials: 'include',
      signal: abort.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('leaderboard_unavailable');
      return response.json() as Promise<McsKongaTeamLeaderboardResponse>;
    }).then((value) => setLeaderboard({ kind: 'ready', value }))
      .catch(() => {
        if (!abort.signal.aborted) setLeaderboard({ kind: 'error' });
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', close);
    presentationRef.current?.focus();
    return () => window.removeEventListener('keydown', close);
  }, [presenting]);

  if (loading) {
    return <main className="konga-team-page" role="status">Loading your real Konga Line…</main>;
  }

  if (error || !snapshot) {
    return (
      <main className="konga-team-page">
        <h1>Your Konga Line</h1>
        <p role="alert">Your live line could not be loaded. Refresh to try again.</p>
      </main>
    );
  }

  const achieved = snapshot.launchProgress.completedCount === 2;

  return (
    <main
      ref={presentationRef}
      className={`konga-team-page${presenting ? ' is-presenting' : ''}`}
      tabIndex={presenting ? -1 : undefined}
      aria-label={presenting ? 'Konga Line presentation mode' : undefined}
    >
      <header className="konga-team-header">
        <div>
          <p className="konga-team-kicker">Team Magnificent · member view</p>
          <h1>{snapshot.head.firstName}'s Konga Line</h1>
          <p>One collective line. Your view begins with your own invitation history.</p>
        </div>
        {snapshot.hasFirstInvite && snapshot.genesis ? (
          <button type="button" onClick={() => setPresenting((value) => !value)} aria-pressed={presenting}>
            {presenting ? <Minimize2 aria-hidden="true" /> : <Expand aria-hidden="true" />}
            {presenting ? 'Exit presentation' : 'Presentation mode'}
          </button>
        ) : null}
      </header>

      <LaunchProgress
        completed={snapshot.launchProgress.completedCount}
        deadlineAt={snapshot.launchProgress.deadlineAt}
        achievedAt={snapshot.launchProgress.achievedAt}
      />

      {achieved ? (
        <div className="konga-team-celebration" role="status">
          <strong>2/2 complete.</strong>
          <span>You put in the effort and helped two people complete enrollment in your first 72 hours.</span>
        </div>
      ) : null}

      {!snapshot.hasFirstInvite || !snapshot.genesis ? (
        <section className="konga-team-before-genesis" aria-labelledby="konga-before-title">
          <p className="konga-team-kicker">Your factual starting point</p>
          <h2 id="konga-before-title">
            <Link to="/ivory">Your line begins with your first invite</Link>
          </h2>
          <p>When your first invitation is actually sent, that person becomes the genesis node in this view.</p>
        </section>
      ) : (
        <section className="konga-team-live" aria-label="Live collective Konga Line">
          <KongaLineView
            lens={snapshot.lens}
            sponsorFullName=""
            viewer={{
              firstName: snapshot.head.firstName,
              positionNumber: null,
              placedAt: null,
              genesis: snapshot.genesis,
            }}
            stream={stream}
            nextWebinar={null}
          />
        </section>
      )}

      <Leaderboard state={leaderboard} />
    </main>
  );
}

function LaunchProgress({
  completed,
  deadlineAt,
  achievedAt,
}: {
  completed: 0 | 1 | 2;
  deadlineAt: string;
  achievedAt: string | null;
}) {
  return (
    <section className="konga-team-progress" aria-labelledby="konga-progress-title">
      <div>
        <p className="konga-team-kicker">First 72 hours · effort target</p>
        <h2 id="konga-progress-title">Help two people complete enrollment</h2>
        <p>{achievedAt ? `Completed ${formatDateTime(achievedAt)}.` : `Window ends ${formatDateTime(deadlineAt)}.`}</p>
      </div>
      <strong aria-label={`${completed} of 2 completed`}>{completed}/2</strong>
    </section>
  );
}

function Leaderboard({ state }: { state: LeaderboardState }) {
  return (
    <section className="konga-team-leaderboard" aria-labelledby="konga-leaderboard-title">
      <div>
        <p className="konga-team-kicker">Members only · lifetime</p>
        <h2 id="konga-leaderboard-title">People adding to the line</h2>
      </div>
      {state.kind === 'loading' ? <p role="status">Loading verified adds…</p> : null}
      {state.kind === 'error' ? <p>Verified lifetime adds are unavailable right now.</p> : null}
      {state.kind === 'ready' && state.value.entries.length === 0 ? <p>No verified adds are available yet.</p> : null}
      {state.kind === 'ready' && state.value.entries.length > 0 ? (
        <ol>
          {state.value.entries.map((entry, index) => (
            <li key={`${entry.firstName}-${entry.lastInitial}-${index}`}>
              <span>{entry.firstName} {entry.lastInitial}.</span>
              <strong>{entry.addsCount} {entry.addsCount === 1 ? 'add' : 'adds'}</strong>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function formatDateTime(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return 'at the recorded time';
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

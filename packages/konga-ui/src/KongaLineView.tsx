import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  MCS_KONGA_D23_CSS_VARIABLES,
  type McsJoinEvent,
  type McsKongaLineLens,
  type McsKongaPlacementEvent,
  type McsKongaPlacementTickerEntry,
} from '@momentum/shared';
import './konga-line.css';

export interface KongaLineConnectionState {
  connecting: boolean;
  connected: boolean;
  errored: boolean;
  ticker: McsKongaPlacementTickerEntry[];
  latestArrival: McsKongaPlacementEvent | null;
  latestJoin: McsJoinEvent | null;
}

export interface KongaLineViewer {
  firstName: string;
  positionNumber: number;
  placedAt: string;
}

export interface KongaLineWebinar {
  eventId: string;
  scheduledFor: string;
  hosts: string[];
}

export interface KongaLineViewProps {
  lens: McsKongaLineLens;
  sponsorFullName: string;
  viewer: KongaLineViewer;
  stream: KongaLineConnectionState;
  nextWebinar: KongaLineWebinar | null;
}

type SignalKind = 'arrival' | 'join';

export function KongaLineView({ lens, sponsorFullName, viewer, stream, nextWebinar }: KongaLineViewProps) {
  const [soundMuted, setSoundMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastSignalAt = useRef<Record<SignalKind, number>>({ arrival: 0, join: 0 });
  const sponsorIdentity = formatPersonIdentity(sponsorFullName);
  const headLabel = lens.head === 'sponsor' ? sponsorIdentity : viewer.firstName;
  const visiblePlacements = useMemo(
    () => stream.ticker.filter((entry) => entry.positionNumber !== viewer.positionNumber).slice(0, 6),
    [stream.ticker, viewer.positionNumber],
  );

  useEffect(() => {
    const arm = () => {
      if (!audioRef.current) {
        const AudioContextCtor = window.AudioContext
          ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        audioRef.current = new AudioContextCtor();
      }
      void audioRef.current.resume().then(() => setAudioReady(true)).catch(() => undefined);
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

  const playSignal = (kind: SignalKind) => {
    const context = audioRef.current;
    if (!context || !audioReady || soundMuted || document.hidden) return;
    const now = Date.now();
    const throttleMs = kind === 'join' ? 3600 : 1800;
    if (now - lastSignalAt.current[kind] < throttleMs) return;
    lastSignalAt.current[kind] = now;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'join' ? 392 : 294, context.currentTime);
    if (kind === 'join') oscillator.frequency.exponentialRampToValueAtTime(587, context.currentTime + 0.32);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === 'join' ? 0.07 : 0.035, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === 'join' ? 0.72 : 0.28));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (kind === 'join' ? 0.75 : 0.3));
  };

  useEffect(() => {
    if (stream.latestArrival) playSignal('arrival');
  }, [stream.latestArrival?.eventId]);

  useEffect(() => {
    if (stream.latestJoin) playSignal('join');
  }, [stream.latestJoin?.eventId]);

  const toggleSound = () => {
    if (soundMuted && audioRef.current) {
      void audioRef.current.resume().then(() => setAudioReady(true)).catch(() => undefined);
    }
    setSoundMuted((value) => !value);
  };

  return (
    <div className="konga-line-shell" style={MCS_KONGA_D23_CSS_VARIABLES as CSSProperties} aria-label="Live Team Magnificent Konga Line">
      <div className="konga-commandbar">
        <div>
          <span className={'konga-live-dot ' + (stream.errored ? 'is-reconnecting' : '')} />
          <span>{stream.errored ? 'Reconnecting to live events' : stream.connected ? 'Live events connected' : 'Connecting to live events'}</span>
        </div>
        <button type="button" className="konga-sound" aria-pressed={soundMuted} onClick={toggleSound}>
          {soundMuted ? 'Turn sound on' : 'Mute sound'}
        </button>
      </div>
      {!soundMuted && !audioReady && (
        <p className="konga-audio-note">Sound is on and activates safely after your first interaction.</p>
      )}

      <div className="konga-dock" id="konga-webinar">
        <div className="konga-dock-copy">
          <span className="konga-mono">Destination dock</span>
          <strong>The next Team Magnificent live conversation</strong>
          <span>Hosted by {nextWebinar?.hosts?.length ? nextWebinar.hosts.join(' & ') : 'the Team Magnificent hosts'}.</span>
        </div>
        <WebinarCountdown scheduledFor={nextWebinar?.scheduledFor ?? null} />
      </div>

      {stream.latestJoin && (
        <div key={stream.latestJoin.eventId} className="konga-join-signal" role="status" aria-live="polite">
          <span>Joined</span>
          <strong>{stream.latestJoin.firstName} {stream.latestJoin.lastInitial}.</strong>
          <span>{formatLocation(stream.latestJoin.city, stream.latestJoin.stateOrRegion)}</span>
        </div>
      )}

      <div className="konga-line-stage">
        <div className="konga-head">
          <span className="konga-mono">{lens.head === 'sponsor' ? 'Your line starts with' : 'Line head'}</span>
          <strong>{headLabel}</strong>
          <span>{lens.head === 'sponsor' ? sponsorIdentity + ' invited you into this view.' : 'Your team view.'}</span>
        </div>

        <div className="konga-rail" aria-label="Vertical upward live placement line">
          <div className="konga-belt" aria-hidden="true" />
          <div className="konga-node-stack">
            {visiblePlacements.map((entry) => (
              <article
                key={`${entry.positionNumber}-${entry.placedAt ?? ''}`}
                className={'konga-node ' + (stream.latestArrival?.positionNumber === entry.positionNumber ? 'is-arriving' : '')}
              >
                <span className="konga-node-marker" aria-hidden="true" />
                <div>
                  <strong>{entry.firstName} {entry.lastInitial}.</strong>
                  <span>{formatLocation(entry.city, entry.stateOrRegion)}</span>
                  {entry.addedBy && <small>added by {entry.addedBy.firstName} {entry.addedBy.lastInitial}.</small>}
                </div>
                <time dateTime={entry.placedAt ?? ''}>{formatClock(entry.placedAt ?? '')}</time>
              </article>
            ))}

            <article className="konga-you" aria-label={'Your pinned position is ' + viewer.positionNumber}>
              <span className="konga-mono">Pinned in your view</span>
              <strong>YOU · {viewer.firstName}</strong>
              <span>Position {viewer.positionNumber.toLocaleString()} · placed {formatPlacedAt(viewer.placedAt)}</span>
            </article>

            {visiblePlacements.length === 0 && (
              <p className="konga-honest-empty">
                {stream.connecting ? 'Connecting to the real placement stream.' : 'No newer real placements are available on this connection yet.'}
              </p>
            )}

            <div className="konga-open-slot"><span>Open arrival space</span></div>
            <div className="konga-open-slot"><span>Open arrival space</span></div>
          </div>
          <div className="konga-arrivals">
            <span className="konga-mono">Real arrivals enter here</span>
            <span>No samples. No simulated activity.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebinarCountdown({ scheduledFor }: { scheduledFor: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scheduledFor) return;
    const target = Date.parse(scheduledFor);
    if (!Number.isFinite(target)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [scheduledFor]);

  if (!scheduledFor || !Number.isFinite(Date.parse(scheduledFor))) {
    return (
      <div className="konga-countdown is-empty">
        <span>Schedule not available</span>
        <small>The next real event will appear when it is published.</small>
      </div>
    );
  }

  const remaining = Math.max(0, Date.parse(scheduledFor) - now);
  const seconds = Math.floor(remaining / 1000);
  const values = [
    { value: Math.floor(seconds / 86400), label: 'days' },
    { value: Math.floor((seconds % 86400) / 3600), label: 'hrs' },
    { value: Math.floor((seconds % 3600) / 60), label: 'min' },
    { value: seconds % 60, label: 'sec' },
  ];

  return (
    <div className="konga-countdown">
      <div className="konga-countdown-grid" aria-label={'Countdown to ' + formatEventDate(scheduledFor)}>
        {values.map((item) => (
          <span key={item.label}>
            <strong>{String(item.value).padStart(2, '0')}</strong>
            <small>{item.label}</small>
          </span>
        ))}
      </div>
      <time dateTime={scheduledFor}>{remaining === 0 ? 'Happening now' : formatEventDate(scheduledFor)}</time>
    </div>
  );
}

function formatLocation(city: string, stateOrRegion: string): string {
  return [city, stateOrRegion].filter(Boolean).join(', ');
}

function formatClock(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatPlacedAt(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return 'time unavailable';
  return value.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatPersonIdentity(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'your inviter';
  const firstName = parts[0];
  if (!firstName) return 'your inviter';
  if (parts.length === 1) return firstName;
  const lastInitial = parts[parts.length - 1]?.slice(0, 1) ?? '';
  return `${firstName} ${lastInitial}.`;
}

function formatEventDate(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

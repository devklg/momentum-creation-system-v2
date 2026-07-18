import { useMemo, useState, type CSSProperties } from 'react';
import {
  MCS_COM_DISCLAIMER,
  MCS_KONGA_CONTRACT_VERSION,
  MCS_KONGA_D23_CSS_VARIABLES,
  type McsCallbackIntent,
  type McsComProspectCopy,
  type McsKongaContractVersion,
  type McsWebinarReplay,
} from '@momentum/shared';
import { postCallbackRequest, postRvmCallbackRequest } from '@/lib/api';
import { usePlacementStream } from '@/lib/usePlacementStream';
import { KongaLine } from './components/KongaLine';
import './tm-prospect-dashboard.css';

export interface TmProspectDashboardProps {
  token: string;
  prospectFirstName: string;
  baFullName: string;
  positionNumber: number;
  placedAt: string;
  nextEvent: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
  onBackToPresentation?: () => void;
  copy?: McsComProspectCopy | null;
  entryKind?: 'pmv' | 'rvm';
  contractVersion?: McsKongaContractVersion | null;
  pageVisitId?: string;
  replay?: McsWebinarReplay | null;
}

export function TmProspectDashboard({
  token,
  prospectFirstName,
  baFullName,
  positionNumber,
  placedAt,
  nextEvent,
  onBackToPresentation,
  entryKind = 'pmv',
  contractVersion = null,
  pageVisitId,
  replay = null,
}: TmProspectDashboardProps) {
  const baFirstName = useMemo(
    () => baFullName.trim().split(/\s+/)[0] || 'your inviter',
    [baFullName],
  );
  const stream = usePlacementStream(
    token,
    entryKind === 'rvm' ? '/api/rvm' : '/api/p',
    pageVisitId,
  );
  const preferredWebinar = stream.contractVersion === MCS_KONGA_CONTRACT_VERSION
    ? stream.nextWebinar
    : nextEvent;
  const isVersioned = contractVersion === MCS_KONGA_CONTRACT_VERSION
    || stream.contractVersion === MCS_KONGA_CONTRACT_VERSION;
  const addedSincePlacement = stream.connected
    ? Math.max(0, stream.globalMaxPosition - positionNumber)
    : null;

  return (
    <main
      className="konga-dashboard"
      style={MCS_KONGA_D23_CSS_VARIABLES as CSSProperties}
    >
      <nav className="konga-nav" aria-label="Dashboard controls">
        <a className="konga-wordmark" href="#arrival" aria-label="Team Magnificent Konga Line">
          TM · KONGA LINE
        </a>
        <div>
          {onBackToPresentation && (
            <button type="button" onClick={onBackToPresentation}>Rewatch presentation</button>
          )}
          <a href="#real-conversation">Talk with {baFirstName}</a>
        </div>
      </nav>

      <section id="arrival" className="konga-section konga-arrival-section" aria-labelledby="arrival-title">
        <div className="konga-arrival-grid">
          <div className="konga-section-heading">
            <span className="konga-eyebrow">As promised — the team, forming</span>
            <h1 id="arrival-title">This is what {baFirstName} wanted you to see. Live.</h1>
            <p>
              The presentation told you something unusual: while you watched, you
              were placed in our team&rsquo;s line so we could show you something real.
              This is it. Every circle is a real person and every data-bearing movement
              is a real event. Nothing on this screen is a simulation.
            </p>
          </div>
          <div className="konga-arrival-position" aria-label={`Your position is ${positionNumber}`}>
            <span>Position</span>
            <strong>{positionNumber.toLocaleString()}</strong>
            <small>is yours while you decide.</small>
          </div>
        </div>
        {stream.sinceLastVisit !== null && (
          <p className="konga-return-note" role="status">
            Welcome back — the line kept moving. {stream.sinceLastVisit.toLocaleString()}
            {' '}{stream.sinceLastVisit === 1 ? 'person arrived' : 'people arrived'} since your last visit.
          </p>
        )}
        {!isVersioned && (
          <p className="konga-contract-note">
            This invitation is using the compatible live view. New visit and weekly
            telemetry will appear when the versioned stream is available.
          </p>
        )}
      </section>

      <section id="product" className="konga-section" aria-labelledby="product-title">
        <SectionHeading
          eyebrow="The first question you're asking"
          title="Does GLP-THREE actually work?"
          id="product-title"
        />
        <p className="konga-lead">
          GLP-THREE is the product you just saw. Team Magnificent is a team of
          people building businesses around sharing it — and this page is their
          work, visible.
        </p>
        <p>
          The presentation is the approved product explanation. Rewatch it as often
          as you need, then ask {baFirstName} about their own experience and sources.
          This dashboard adds no unsourced efficacy, market, price, side-effect, or
          launch-date claim.
        </p>
        {onBackToPresentation && (
          <button type="button" className="konga-content-control" onClick={onBackToPresentation}>
            Rewatch Dr. Dan&rsquo;s presentation
          </button>
        )}
        <CallbackLink baFirstName={baFirstName} />
      </section>

      <section id="opportunity" className="konga-section konga-panel-section" aria-labelledby="opportunity-title">
        <SectionHeading
          eyebrow="The offer"
          title="What exactly is the opportunity here?"
          id="opportunity-title"
        />
        <p className="konga-lead">
          Plainly: you&rsquo;re being offered the chance to build a business of your
          own. As a builder, you&rsquo;d earn from real work: sharing the product with
          people who want it, and helping people who want to build do the same —
          with this system working alongside you. It is not a job, an investment,
          or a lottery ticket. It is a business, with no guarantees and results
          that follow effort.
        </p>
        <p>
          Whether it becomes a new financial future depends on the same thing every
          real business depends on — the work you put in. The line shows team
          activity; it promises neither placement nor results.
        </p>
        <p className="konga-stack-intro">Three of these you have already seen. Two you can only see here.</p>
        <div className="konga-reason-stack" aria-label="Five reasons to examine">
          <Reason number="01" title="Product">
            Rewatch the presentation, then ask {baFirstName} what they use and what
            they have personally observed.
          </Reason>
          <Reason number="02" title="Timing">
            Ask why {baFirstName} chose to share this with you now.
          </Reason>
          <Reason number="03" title="Market">
            Bring the category questions and source questions to the conversation.
          </Reason>
          <Reason number="04" title="Method">
            The working method is visible here: share, real response, live placement,
            and human follow-up.
          </Reason>
          <Reason number="05" title="Team & training">
            You are not being asked to evaluate a business without the people and
            support around it.
          </Reason>
        </div>
        <div className="konga-pmv" aria-label="People Momentum Volume Checks">
          <span>People</span><span>Momentum</span><span>Volume</span><span>Checks</span>
        </div>
        <CallbackLink baFirstName={baFirstName} />
      </section>

      <section id="mechanic" className="konga-section" aria-labelledby="mechanic-title">
        <SectionHeading eyebrow="How the line works" title="Three steps — and two already happened." id="mechanic-title" />
        <div className="konga-three-column">
          <div className="konga-copy-card">
            <span className="konga-card-index">01</span>
            <h3>Shared</h3>
            <p>{baFirstName} shared a private presentation with you. That invitation fixed the person connected to your experience.</p>
          </div>
          <div className="konga-copy-card">
            <span className="konga-card-index">02</span>
            <h3>Watched</h3>
            <p>Completing the presentation created the pinned position you see. It represents a real placement in this shared line.</p>
          </div>
          <div className="konga-copy-card">
            <span className="konga-card-index">03</span>
            <h3>Deciding</h3>
            <p>When a person decides to build, a verified join exits at the front in gold. The system never invents that moment.</p>
          </div>
        </div>
      </section>

      <section id="live-place" className="konga-section konga-panel-section" aria-labelledby="live-place-title">
        <SectionHeading eyebrow="Your live place" title="What am I watching?" id="live-place-title" />
        <p className="konga-lead">
          Each circle is a real person added by someone on the team. New arrivals
          enter at the bottom. Verified joins leave at the destination above. The
          marker that stays fixed is you.
        </p>
        <KongaLine
          lens={{ head: 'sponsor' }}
          sponsorFullName={baFullName}
          viewer={{ firstName: prospectFirstName, positionNumber, placedAt }}
          stream={stream}
          nextWebinar={preferredWebinar}
        />
        <div className="konga-telemetry">
          <Metric value={addedSincePlacement} label="added since your placement" empty="Live total not available yet" />
          <Metric value={stream.placementsThisWeek} label="placements this week" empty="Weekly total not available yet" />
          <Metric value={stream.geoSpreadCount} label="cities & states represented" empty="Geographic total not available yet" />
        </div>
        <p className="konga-data-note">
          Every value above comes from the live Konga contract. Empty means the
          system did not supply a trustworthy number.
        </p>
        {replay?.publicationStatus === 'active' && (
          <p className="konga-replay-note">
            Last live conversation: recording dated {replay.displayDate}. The
            recording remains a content resource; completing it does not create a
            placement or promise an outcome.
          </p>
        )}
      </section>

      <section id="system" className="konga-section" aria-labelledby="system-title">
        <SectionHeading eyebrow="The second question you're asking" title="Could someone like me actually do this?" id="system-title" />
        <p className="konga-lead">
          THE SYSTEM YOU&apos;VE BEEN PLACED INSIDE — What you&apos;re looking at isn&apos;t a webpage — it&apos;s a live view into a working system built for one thing: helping people build a business without doing it alone. The line you&apos;re watching is real. Every arrival is a real person, added by a real team member, right now. When you join, that same machinery starts working alongside you: an AI-guided onboarding that captures your why and builds your launch plan around it, a daily success coach that keeps you moving, a 72-hour launch mission with the whole system pointed at your first two wins, weekly live webinars — with last week&apos;s always available on replay — and a placement engine that puts the team&apos;s momentum next to your own effort. Most opportunities hand you a starter kit and a phone. This one hands you an operating system. It won&apos;t do the work for you — nothing real does. But you&apos;ll never work without it.
        </p>
        <CallbackLink baFirstName={baFirstName} />
      </section>

      <section id="tm-advantage" className="konga-section konga-panel-section" aria-labelledby="advantage-title">
        <SectionHeading
          eyebrow="Why this team"
          title="Building alone is why most people quit. So nobody here builds alone."
          id="advantage-title"
        />
        <p className="konga-lead">
          Team Magnificent pairs you with the person who shared this with you —
          someone who was once exactly where you are — plus a team already in
          motion. The line on this page is their daily work, made visible.
        </p>
        <p className="konga-signoff">Built by magnificent people. Driven by purpose.</p>
      </section>

      <RealConversation
        token={token}
        baFirstName={baFirstName}
        entryKind={entryKind}
      />

      <footer className="konga-footer">
        <div>
          <span>Team Magnificent</span>
        </div>
        <p>{MCS_COM_DISCLAIMER}</p>
        <div className="konga-footer-links" aria-label="Legal links">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true">•</span>
          <a href="/terms">Terms of Service</a>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="konga-section-heading">
      <span className="konga-eyebrow">{eyebrow}</span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function Reason({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <article>
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

function CallbackLink({ baFirstName }: { baFirstName: string }) {
  return <a className="konga-callback-link" href="#real-conversation">Request a call from {baFirstName}</a>;
}

function Metric({ value, label, empty }: { value: number | null; label: string; empty: string }) {
  return (
    <article>
      {value === null ? <strong className="is-empty">—</strong> : <strong>{value.toLocaleString()}</strong>}
      <span>{label}</span>
      {value === null && <small>{empty}</small>}
    </article>
  );
}

function RealConversation({ token, baFirstName, entryKind }: {
  token: string;
  baFirstName: string;
  entryKind: 'pmv' | 'rvm';
}) {
  const [intent, setIntent] = useState<McsCallbackIntent | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!intent || !consent || submitting) return;
    setSubmitting(true);
    setError(null);
    const post = entryKind === 'rvm' ? postRvmCallbackRequest : postCallbackRequest;
    const result = await post(token, intent);
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      return;
    }
    setError(
      result.error.kind === 'expired'
        ? 'This invitation has expired. Ask your inviter for a fresh one.'
        : 'Your request did not land. Please try again.',
    );
  };

  return (
    <section id="real-conversation" className="konga-section konga-conversation" aria-labelledby="conversation-title">
      <SectionHeading eyebrow="What to do now" title="The next step is a conversation — not a commitment." id="conversation-title" />
      <p className="konga-lead">
        Talk to {baFirstName} — the person who thought of you. Ask the money
        question. Ask the time question. Ask what a bad week looks like. This
        starts a real conversation with a real person.
      </p>

      {submitted ? (
        <div className="konga-confirmation" role="status">
          <span>Request received</span>
          <h3>{baFirstName} will reach out.</h3>
          <p>Keep an eye on the number where you received this invitation.</p>
        </div>
      ) : (
        <div className="konga-conversation-form">
          <fieldset>
            <legend>What would you like to talk about?</legend>
            <IntentOption value="interested_tell_me_more" current={intent} setIntent={setIntent}>
              I&rsquo;m interested — help me understand more.
            </IntentOption>
            <IntentOption value="have_questions" current={intent} setIntent={setIntent}>
              I have specific questions.
            </IntentOption>
            <IntentOption value="ready_to_join" current={intent} setIntent={setIntent}>
              I&rsquo;m ready to discuss joining Team Magnificent.
            </IntentOption>
          </fieldset>

          <label className="konga-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              By sharing your number, you agree that {baFirstName} / Team Magnificent
              may call or text you about your request. Message &amp; data rates may
              apply. Message frequency varies. Reply STOP to end texts, HELP for help. Review the
              <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.
            </span>
          </label>

          {error && <p className="konga-form-error" role="alert">{error}</p>}
          <button type="button" onClick={() => void submit()} disabled={!intent || !consent || submitting}>
            {submitting ? 'Sending…' : 'Request a call from ' + baFirstName}
          </button>
        </div>
      )}
    </section>
  );
}

function IntentOption({ value, current, setIntent, children }: {
  value: McsCallbackIntent;
  current: McsCallbackIntent | null;
  setIntent: (value: McsCallbackIntent) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={current === value ? 'is-selected' : ''}>
      <input type="radio" name="callback-intent" checked={current === value} onChange={() => setIntent(value)} />
      <span>{children}</span>
    </label>
  );
}

export default TmProspectDashboard;

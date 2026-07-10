/**
 * Momentum Creation System API.
 * Single Express server, shared by apps/com, apps/team, apps/admin.
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { welcomeRoutes } from './routes/welcome.js';
import { questionnaireRoutes } from './routes/questionnaire.js';
import { sponsorWorkbookRoutes } from './routes/sponsor-workbook.js';
import { adminAccessCodesRoutes } from './routes/admin/access-codes.js';
import { adminBasRoutes } from './routes/admin/bas.js';
import { adminProspectsRoutes } from './routes/admin/prospects.js';
import { adminQueueRoutes } from './routes/admin/queue.js';
import { adminAuditRoutes } from './routes/admin/audit.js';
import { adminDashboardRoutes } from './routes/admin/dashboard.js';
import { adminReportingRoutes } from './routes/admin/reporting.js';
import { adminLiveOpsRoutes } from './routes/admin/liveOps.js';
import { adminBroadcastRoutes } from './routes/admin/broadcast.js';
import { adminTenantRoutes } from './routes/admin/tenant.js';
import { adminOrientationRoutes } from './routes/admin/orientation.js';
import { adminVmRoutes } from './routes/admin/vm.js';
import { adminAgentsRoutes } from './routes/admin/agents.js';
import { adminKnowledgeRoutes } from './routes/admin/knowledge.js';
import { adminMichaelRuntimeObservabilityRoutes } from './routes/admin/michael-runtime-observability.js';
import { adminContentVideoRoutes } from './routes/admin/content-videos.js';
import { adminHealthRoutes } from './routes/admin/health.js';
import { startBroadcastWorker, stopBroadcastWorker } from './services/broadcastQueue.js';
import { startVmDeliveryWorker, stopVmDeliveryWorker } from './workers/vmDeliveryWorker.js';
import { startVmImportWorker, stopVmImportWorker } from './workers/vmImportWorker.js';
import { startVmWebhookWorker, stopVmWebhookWorker } from './workers/vmWebhookWorker.js';
import { startProjectionOutboxWorker, stopProjectionOutboxWorker } from './services/projectionOutbox.js';
import { ensureChromaCollections } from './services/chromaCollections.js';
import {
  connectDirectPersistence,
  closeDirectPersistence,
} from './services/persistence/index.js';
import { telnyxWebhookRoutes } from './routes/telnyx-webhook.js';
import { vmProviderWebhookRoutes } from './routes/vmProviderWebhooks.js';
import { michaelRoutes } from './routes/michael.js';
import { steveRoutes } from './routes/steve.js';
import { prospectTokenRoutes } from './routes/p.js';
import { prospectLoginRoutes } from './routes/p-login.js';
import { invitationRoutes } from './routes/invitations.js';
import { cockpitRoutes } from './routes/cockpit.js';
import { crmRoutes } from './routes/crm.js';
import { crmHubRoutes } from './routes/crmHub.js';
import { rvmRoutes } from './routes/rvm.js';
import { scriptmakerRoutes } from './routes/scriptmaker.js';
import { ivoryRoutes } from './routes/ivory.js';
import { agentRoutes } from './routes/agents.js';
import { vmRoutes } from './routes/vm.js';
import { trainingRoutes } from './routes/training.js';
import { profileRoutes } from './routes/profile.js';
import { previewRoutes } from './routes/preview.js';
import { orientationRoutes } from './routes/orientation.js';
import { threeWayRoutes } from './routes/three-way.js';
import { michaelRuntimeRoutes } from './routes/michael-runtime.js';
import { contentVideoRoutes } from './routes/content-videos.js';
import { knowledgeEvolutionRoutes } from './runtime/knowledge-evolution/routes.js';
// Imported so the module is part of the build graph and verified by tsc even
// before any route uses it. Future BA-facing routes (cockpit, fast-start,
// training/day-2+, invitations) import this directly. See the
// "BA-facing gated routes" block below for the canonical mount pattern.
import { requireSteveComplete as _requireSteveComplete } from './middleware/requireSteveComplete.js';
void _requireSteveComplete;

const app = express();

app.disable('x-powered-by');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RAW-BODY ROUTES â€” must mount BEFORE express.json().
//
// Telnyx webhooks are Ed25519-signed over the raw payload bytes; if
// express.json() runs first, those bytes are gone and signature verification
// is impossible. The route file uses express.raw() internally for this
// specific path only â€” everything else still gets JSON parsing below.
// DO NOT reorder these lines.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/telnyx', telnyxWebhookRoutes);

app.use(cookieParser());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin/no-origin (curl, server-to-server)
      if (!origin) return cb(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
// Kevin-only Knowledge Base upload accepts base64-encoded files. Keep the
// larger JSON limit scoped to this admin route instead of widening the whole API.
app.use('/api/admin/knowledge', express.json({ limit: '25mb' }), adminKnowledgeRoutes);

app.use(express.json({ limit: '256kb' }));

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PRE-GATE ROUTES â€” must NOT use requireSteveComplete.
// These are the routes a brand-new BA has to reach BEFORE the gate closes
// (they are how the gate gets opened). Per Chat #97 whitelist:
//   /api/health, /api/auth/*, /api/welcome/*, /api/steve/*
// /admin uses its own requireAdmin gate â€” founders bypass Steve entirely.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/onboarding/questionnaire', questionnaireRoutes);
app.use('/api/sponsor/workbook', sponsorWorkbookRoutes);
app.use('/api/michael', michaelRoutes);
// Steve — New BA Discovery & Success Interview (SEPARATE agent; does NOT score,
// rank, or classify; does NOT touch Michael graph data).
// BA-facing self-reads are pre-gate (a
// brand-new BA reaches their own discovery state); worker ingest/system-prompt
// are STEVE_WORKER_SECRET guarded; the sponsor-only profile read applies
// requireSteveComplete internally. Steve never scores or judges.
app.use('/api/steve', steveRoutes);
app.use('/api/admin/access-codes', adminAccessCodesRoutes);
app.use('/api/admin/bas', adminBasRoutes);
app.use('/api/admin/prospects', adminProspectsRoutes);
app.use('/api/admin/queue', adminQueueRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/reporting', adminReportingRoutes);
app.use('/api/admin/live-ops', adminLiveOpsRoutes);
app.use('/api/admin/tenant', adminTenantRoutes);
app.use('/api/admin/vm', adminVmRoutes);
app.use('/api/admin/agents', adminAgentsRoutes);
// ADMIN Section G — Kevin-only broadcast composer (Chat #144). BA-facing
// only: audience resolution filters out STOP-list members server-side; the
// composer never reaches prospects, never appears on `.com`.
app.use('/api/admin/broadcast', adminBroadcastRoutes);
// ADMIN — group orientation roster + seeding (Chat #147, wireframe §3.6).
// Kevin-only via requireAdmin inside the route file; founders view per-session
// rosters and add sessions as the team grows. Audit-logged like the rest of /admin.
app.use('/api/admin/orientation', adminOrientationRoutes);
// ADMIN — Sprint 3 S3.6 in-memory Michael runtime observability snapshot.
// Kevin-only via requireAdmin; pure in-memory read, no persistence, no audit.
app.use('/api/admin/michael-runtime', adminMichaelRuntimeObservabilityRoutes);
app.use('/api/admin/content/videos', adminContentVideoRoutes);
app.use('/api/admin/health', adminHealthRoutes);
app.use('/api/runtime/knowledge-evolution', knowledgeEvolutionRoutes);

// /api/p/* is prospect-facing (apps/com). No auth, no Steve gate. The token
// itself is the identity surface per COM Design Section E.3.
//
// IMPORTANT: prospectLoginRoutes mounts FIRST at /api/p/login so its more
// specific routes (/start, /redeem) take precedence over the general
// /:token wildcard inside prospectTokenRoutes. Without this ordering, a
// request to /api/p/login/start would resolve as token="login" and 404
// inside prospectTokenRoutes before ever reaching the login router.
//
// Locked-spec 3.17 (Chat #131 â€” prospect re-entry, magic-link login):
//   POST /api/p/login/start    body: { phone }
//   POST /api/p/login/redeem   body: { linkToken }
// Cookie scope: .teammagnificent.com, distinct from the BA .team JWT.
app.use('/api/p/login', prospectLoginRoutes);
app.use('/api/p', prospectTokenRoutes);
app.use('/api/rvm', rvmRoutes);
// VM provider/import foundation. Provider webhooks are unauthenticated but
// secret-guarded when VM_WEBHOOK_SHARED_SECRET is set; live delivery is still
// feature-flagged and campaign-admin-approved in the delivery worker.
app.use('/api/vm/provider', vmProviderWebhookRoutes);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BA-FACING GATED ROUTES â€” mount here.
// Every new authenticated BA-facing route mounted below this line must use
// the pair (requireAuth, requireSteveComplete) on its handlers so the
// 403-until-Steve-complete contract holds project-wide.
//
// Canonical pattern inside a route file:
//
//   import { requireAuth } from '../middleware/requireAuth.js';
//   import { requireSteveComplete }
//     from '../middleware/requireSteveComplete.js';
//
//   router.get('/', requireAuth, requireSteveComplete, handler);
//
// Pending mounts (Chat #97 priorities 8â€“10 carry forward):
//   app.use('/api/training', trainingRoutes);     // /training/day-1 whitelisted; day-2+ gated
//   app.use('/api/cockpit', cockpitRoutes);       // gated
//   app.use('/api/fast-start', fastStartRoutes);  // gated
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Invitation spine (Chat #119) â€” the production line (locked-spec 1.8). Each
// handler applies (requireAuth, requireSteveComplete) internally; sponsor
// is derived from the session, never the body (locked-spec 3.5).
app.use('/api/invitations', invitationRoutes);

// Cockpit read-side (Chat #121) â€” the My Invites loop. GET-only; the BA id
// comes from the session, every read is scoped to that BA (locked-spec 3.5).
app.use('/api/cockpit', cockpitRoutes);

// BA CRM write-side (Chat #132) â€” wireframe 3.3 CRM leaves. The WRITE
// companion to /api/cockpit/*: notes, follow-up reminders, dispositions,
// re-invite, and the Today's Actions card (derived from existing pipeline).
// Each handler applies (requireAuth, requireSteveComplete) internally;
// every mutation runs assertOwnership(prospectId, session.tmagId) first so a
// BA can only read or write their OWN prospects (locked-spec 3.5).
app.use('/api/crm', crmRoutes);
app.use('/api/crm-hub', crmHubRoutes);

// ScriptMaker draft engine (Chat #122) â€” the video-library front door's
// server side. Drafts a product-anchored invitation message; the BA carries
// the draft to /api/invitations (source='scriptmaker'). DRAFTS ONLY â€” no
// mint, no send (Chat #118 boundary). Gated (requireAuth +
// requireSteveComplete) inside the route. Degrades to a neutral fallback
// when ANTHROPIC_API_KEY is unset (dormant today).
app.use('/api/scriptmaker', scriptmakerRoutes);

// Ivory + Generator (Chat #131 â€” wireframe Â§3.4). The BA-private warm-market
// roster, an LLM WDYK coach, and the per-product Generator runs that converge
// selected names onto /p/{token} mints via the existing spine (source='ivory').
// All routes gated (requireAuth + requireSteveComplete) inside the file.
app.use('/api/ivory', ivoryRoutes);
// Agent Orchestration Layer (feature/agent-orchestrator). Read-only
// recommendation feed + append-only interaction events; the underlying
// Michael/Ivory/Steve lane logic stays in its existing domain modules.
app.use('/api/agents', agentRoutes);
app.use('/api/vm', vmRoutes);
// Fast Start Training (feat/fast-start-training, wireframe 3.5).
// GET /fast-start/progress + GET-1 whitelisted pre-Steve in
// requireSteveComplete whitelist; POST .../modules/2-5/state stay gated.
// Sequential UI, not hard-gated (TASK.md open-question answer).
app.use('/api/training', trainingRoutes);

// BA profile / settings (Chat #134, wireframe 3.8). Handlers apply
// requireAuth + requireSteveComplete internally; /api/profile is also
// in the Steve gate whitelist so a BA mid-onboarding can still set timezone
// and notif prefs. All reads/writes scoped to req.session.tmagId (3.5).
app.use('/api/profile', profileRoutes);

// Replicated .com preview (Chat #134, wireframe 3.7). Sandboxed token
// resolver — the BA previews their OWN replicated .com page personalized
// to themselves as the inviting BA, with a sample prospect. ZERO writes:
// no holding-tank placement, no SSE emit, no counter increment, no SMS.
// Gated (requireAuth + requireSteveComplete) inside the route file.
app.use('/api/preview', previewRoutes);

// Group orientation scheduler (Chat #147, wireframe §3.6). BA-facing cockpit
// scheduling card: a post-Steve BA sees available group sessions, books one
// seat (cap 10), and can cancel. Handlers apply (requireAuth +
// requireSteveComplete) internally; tmagId is read from the session, never the
// body (locked-spec 3.5). REUSES the §2.6 webinar event/reservation pattern.
app.use('/api/orientation', orientationRoutes);

// Three-way call scheduling v1 (BRIEF 5). UPLINE-CHAIN routing is enforced in
// the route/domain; no leader/admin role gate, only auth + Steve completion.
app.use('/api/three-way', threeWayRoutes);

// Sprint 3 S3.4 minimal Michael runtime route (gated BA route family). Handler
// applies (requireAuth + requireSteveComplete) internally and is fail-closed
// behind the default-off MICHAEL_RUNTIME_* kill switch. Fixtures-only via the
// S2.20 facade; no persistence/LLM/voice. Distinct from the pre-gate
// /api/michael onboarding route; the reserved bare runtime namespace stays
// unmounted.
app.use('/api/michael-runtime', michaelRuntimeRoutes);
app.use('/api/content', contentVideoRoutes);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// â”€â”€ BOOT ASSERTION (#147) â€” Chroma collections must exist before writes. â”€â”€
// Same failure class as the #140 audit_log fix and the #145 mcs_ivory orphan:
// ChromaDB add() does not auto-create collections, so a missing collection
// 500's the Chroma leg AFTER Mongo has committed. ensureChromaCollections()
// idempotently creates any registered collection that's missing and logs
// loudly; the write-time guard in tripleStack.ts is the per-write safety net.
// Awaited before listen so a fresh environment self-heals at startup. Does NOT
// touch the route mount ORDER above.
await connectDirectPersistence();
await ensureChromaCollections();

const httpServer = app.listen(env.SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[momentum-server] listening on :${env.SERVER_PORT} (${env.NODE_ENV}) â€” admin BA IDs configured: ${env.ADMIN_TMAG_IDS.length}`,
  );
});

// ADMIN Section G — broadcast delivery worker (Chat #144). Tails
// `broadcast_recipients` for queued rows and dispatches via Telnyx + Resend.
// Idempotent: safe even if invoked outside the listen callback (start order
// doesn't matter — the worker queries the stores directly, not the listening port).
void startBroadcastWorker();
void startVmImportWorker();
void startVmDeliveryWorker();
void startVmWebhookWorker();
// Projection-outbox drain loop (Phase 10 audit H1). The tiered writer enqueues
// failed Tier-2/3 Neo4j/Chroma projections to a durable Mongo outbox; this
// worker replays them until they land or are dead-lettered. Without it the
// outbox accumulates forever and Neo4j/Chroma silently drift from Mongo.
startProjectionOutboxWorker();

// Graceful shutdown (fixes SIGKILL-on-restart drift). systemd sends SIGTERM on
// restart/stop. Order matters: stop the workers FIRST so their next tick can't
// run a query against a closing Mongo connection (the old hook closed
// persistence while workers kept ticking -> "Client must be connected" spam ->
// process never exited cleanly -> systemd SIGKILL after stop-timeout). Sequence:
// 1) stop worker intervals  2) stop accepting HTTP  3) close persistence  4) exit.
let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[momentum-server] ${signal} received — graceful shutdown`);
  // Hard safety net: never hang past 10s (systemd's TimeoutStopSec is the outer bound).
  const failsafe = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[momentum-server] shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  failsafe.unref();
  try {
    // 1) stop workers before anything touches the DB connections
    stopBroadcastWorker();
    stopVmImportWorker();
    stopVmDeliveryWorker();
    stopVmWebhookWorker();
    stopProjectionOutboxWorker();
    // 2) stop accepting new connections
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    // small drain window so an already-in-flight worker tick can finish its
    // current DB op before we close the connection underneath it
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // 3) close persistence (Mongo + Neo4j) after workers are quiet
    await closeDirectPersistence();
    // eslint-disable-next-line no-console
    console.log('[momentum-server] graceful shutdown complete');
    clearTimeout(failsafe);
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[momentum-server] error during shutdown', err);
    clearTimeout(failsafe);
    process.exit(1);
  }
}
process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => void gracefulShutdown('SIGINT'));

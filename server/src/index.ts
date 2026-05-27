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
import { adminBroadcastRoutes } from './routes/admin/broadcast.js';
import { startBroadcastWorker } from './services/broadcastQueue.js';
import { telnyxWebhookRoutes } from './routes/telnyx-webhook.js';
import { michaelRoutes } from './routes/michael.js';
import { prospectTokenRoutes } from './routes/p.js';
import { prospectLoginRoutes } from './routes/p-login.js';
import { invitationRoutes } from './routes/invitations.js';
import { cockpitRoutes } from './routes/cockpit.js';
import { crmRoutes } from './routes/crm.js';
import { scriptmakerRoutes } from './routes/scriptmaker.js';
import { ivoryRoutes } from './routes/ivory.js';
import { trainingRoutes } from './routes/training.js';
import { profileRoutes } from './routes/profile.js';
import { previewRoutes } from './routes/preview.js';
// Imported so the module is part of the build graph and verified by tsc even
// before any route uses it. Future BA-facing routes (cockpit, fast-start,
// training/day-2+, invitations) import this directly. See the
// "BA-facing gated routes" block below for the canonical mount pattern.
import { requireMichaelComplete as _requireMichaelComplete } from './middleware/requireMichaelComplete.js';
void _requireMichaelComplete;

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

app.use(express.json({ limit: '256kb' }));
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PRE-GATE ROUTES â€” must NOT use requireMichaelComplete.
// These are the routes a brand-new BA has to reach BEFORE the gate closes
// (they are how the gate gets opened). Per Chat #97 whitelist:
//   /api/health, /api/auth/*, /api/welcome/*, /api/michael/*
// /admin uses its own requireAdmin gate â€” founders bypass Michael entirely.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/onboarding/questionnaire', questionnaireRoutes);
app.use('/api/sponsor/workbook', sponsorWorkbookRoutes);
app.use('/api/michael', michaelRoutes);
app.use('/api/admin/access-codes', adminAccessCodesRoutes);
app.use('/api/admin/bas', adminBasRoutes);
app.use('/api/admin/prospects', adminProspectsRoutes);
app.use('/api/admin/queue', adminQueueRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/reporting', adminReportingRoutes);
// ADMIN Section G — Kevin-only broadcast composer (Chat #144). BA-facing
// only: audience resolution filters out STOP-list members server-side; the
// composer never reaches prospects, never appears on `.com`.
app.use('/api/admin/broadcast', adminBroadcastRoutes);

// /api/p/* is prospect-facing (apps/com). No auth, no Michael gate. The token
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BA-FACING GATED ROUTES â€” mount here.
// Every new authenticated BA-facing route mounted below this line must use
// the pair (requireAuth, requireMichaelComplete) on its handlers so the
// 403-until-Michael-complete contract holds project-wide.
//
// Canonical pattern inside a route file:
//
//   import { requireAuth } from '../middleware/requireAuth.js';
//   import { requireMichaelComplete }
//     from '../middleware/requireMichaelComplete.js';
//
//   router.get('/', requireAuth, requireMichaelComplete, handler);
//
// Pending mounts (Chat #97 priorities 8â€“10 carry forward):
//   app.use('/api/training', trainingRoutes);     // /training/day-1 whitelisted; day-2+ gated
//   app.use('/api/cockpit', cockpitRoutes);       // gated
//   app.use('/api/fast-start', fastStartRoutes);  // gated
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Invitation spine (Chat #119) â€” the production line (locked-spec 1.8). Each
// handler applies (requireAuth, requireMichaelComplete) internally; sponsor
// is derived from the session, never the body (locked-spec 3.5).
app.use('/api/invitations', invitationRoutes);

// Cockpit read-side (Chat #121) â€” the My Invites loop. GET-only; the BA id
// comes from the session, every read is scoped to that BA (locked-spec 3.5).
app.use('/api/cockpit', cockpitRoutes);

// BA CRM write-side (Chat #132) â€” wireframe 3.3 CRM leaves. The WRITE
// companion to /api/cockpit/*: notes, follow-up reminders, dispositions,
// re-invite, and the Today's Actions card (derived from existing pipeline).
// Each handler applies (requireAuth, requireMichaelComplete) internally;
// every mutation runs assertOwnership(prospectId, session.baId) first so a
// BA can only read or write their OWN prospects (locked-spec 3.5).
app.use('/api/crm', crmRoutes);

// ScriptMaker draft engine (Chat #122) â€” the video-library front door's
// server side. Drafts a product-anchored invitation message; the BA carries
// the draft to /api/invitations (source='scriptmaker'). DRAFTS ONLY â€” no
// mint, no send (Chat #118 boundary). Gated (requireAuth +
// requireMichaelComplete) inside the route. Degrades to a neutral fallback
// when ANTHROPIC_API_KEY is unset (dormant today).
app.use('/api/scriptmaker', scriptmakerRoutes);

// Ivory + Generator (Chat #131 â€” wireframe Â§3.4). The BA-private warm-market
// roster, an LLM WDYK coach, and the per-product Generator runs that converge
// selected names onto /p/{token} mints via the existing spine (source='ivory').
// All routes gated (requireAuth + requireMichaelComplete) inside the file.
app.use('/api/ivory', ivoryRoutes);
// Fast Start Training (feat/fast-start-training, wireframe 3.5).
// GET /fast-start/progress + GET-1 whitelisted pre-Michael in
// MICHAEL_GATE_WHITELIST; POST .../modules/2-5/state stay gated.
// Sequential UI, not hard-gated (TASK.md open-question answer).
app.use('/api/training', trainingRoutes);

// BA profile / settings (Chat #134, wireframe 3.8). Handlers apply
// requireAuth + requireMichaelComplete internally; /api/profile is also
// in MICHAEL_GATE_WHITELIST so a BA mid-onboarding can still set timezone
// and notif prefs. All reads/writes scoped to req.session.baId (3.5).
app.use('/api/profile', profileRoutes);

// Replicated .com preview (Chat #134, wireframe 3.7). Sandboxed token
// resolver — the BA previews their OWN replicated .com page personalized
// to themselves as the inviting BA, with a sample prospect. ZERO writes:
// no holding-tank placement, no SSE emit, no counter increment, no SMS.
// Gated (requireAuth + requireMichaelComplete) inside the route file.
app.use('/api/preview', previewRoutes);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(env.SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[momentum-server] listening on :${env.SERVER_PORT} (${env.NODE_ENV}) â€” admin BA IDs configured: ${env.ADMIN_BA_IDS.length}`,
  );
});

// ADMIN Section G — broadcast delivery worker (Chat #144). Tails
// `broadcast_recipients` for queued rows and dispatches via Telnyx + Resend.
// Idempotent: safe even if invoked outside the listen callback (start order
// doesn't matter — the worker queries the gateway, not the listening port).
void startBroadcastWorker();

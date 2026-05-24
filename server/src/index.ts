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
import { telnyxWebhookRoutes } from './routes/telnyx-webhook.js';
import { michaelRoutes } from './routes/michael.js';
import { prospectTokenRoutes } from './routes/p.js';
import { prospectLoginRoutes } from './routes/p-login.js';
import { invitationRoutes } from './routes/invitations.js';
import { cockpitRoutes } from './routes/cockpit.js';
import { scriptmakerRoutes } from './routes/scriptmaker.js';
import { trainingRoutes } from './routes/training.js';
// Imported so the module is part of the build graph and verified by tsc even
// before any route uses it. Future BA-facing routes (cockpit, fast-start,
// training/day-2+, invitations) import this directly. See the
// "BA-facing gated routes" block below for the canonical mount pattern.
import { requireMichaelComplete as _requireMichaelComplete } from './middleware/requireMichaelComplete.js';
void _requireMichaelComplete;

const app = express();

app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────────────────────
// RAW-BODY ROUTES — must mount BEFORE express.json().
//
// Telnyx webhooks are Ed25519-signed over the raw payload bytes; if
// express.json() runs first, those bytes are gone and signature verification
// is impossible. The route file uses express.raw() internally for this
// specific path only — everything else still gets JSON parsing below.
// DO NOT reorder these lines.
// ─────────────────────────────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────────
// PRE-GATE ROUTES — must NOT use requireMichaelComplete.
// These are the routes a brand-new BA has to reach BEFORE the gate closes
// (they are how the gate gets opened). Per Chat #97 whitelist:
//   /api/health, /api/auth/*, /api/welcome/*, /api/michael/*
// /admin uses its own requireAdmin gate — founders bypass Michael entirely.
// ────────────────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/onboarding/questionnaire', questionnaireRoutes);
app.use('/api/sponsor/workbook', sponsorWorkbookRoutes);
app.use('/api/michael', michaelRoutes);
app.use('/api/admin/access-codes', adminAccessCodesRoutes);
app.use('/api/admin/bas', adminBasRoutes);

// /api/p/* is prospect-facing (apps/com). No auth, no Michael gate. The token
// itself is the identity surface per COM Design Section E.3.
//
// IMPORTANT: prospectLoginRoutes mounts FIRST at /api/p/login so its more
// specific routes (/start, /redeem) take precedence over the general
// /:token wildcard inside prospectTokenRoutes. Without this ordering, a
// request to /api/p/login/start would resolve as token="login" and 404
// inside prospectTokenRoutes before ever reaching the login router.
//
// Locked-spec 3.17 (Chat #131 — prospect re-entry, magic-link login):
//   POST /api/p/login/start    body: { phone }
//   POST /api/p/login/redeem   body: { linkToken }
// Cookie scope: .teammagnificent.com, distinct from the BA .team JWT.
app.use('/api/p/login', prospectLoginRoutes);
app.use('/api/p', prospectTokenRoutes);

// ────────────────────────────────────────────────────────────────────────────
// BA-FACING GATED ROUTES — mount here.
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
// Pending mounts (Chat #97 priorities 8–10 carry forward):
//   app.use('/api/training', trainingRoutes);     // /training/day-1 whitelisted; day-2+ gated
//   app.use('/api/cockpit', cockpitRoutes);       // gated
//   app.use('/api/fast-start', fastStartRoutes);  // gated
// ────────────────────────────────────────────────────────────────────────────

// Invitation spine (Chat #119) — the production line (locked-spec 1.8). Each
// handler applies (requireAuth, requireMichaelComplete) internally; sponsor
// is derived from the session, never the body (locked-spec 3.5).
app.use('/api/invitations', invitationRoutes);

// Cockpit read-side (Chat #121) — the My Invites loop. GET-only; the BA id
// comes from the session, every read is scoped to that BA (locked-spec 3.5).
app.use('/api/cockpit', cockpitRoutes);

// ScriptMaker draft engine (Chat #122) — the video-library front door's
// server side. Drafts a product-anchored invitation message; the BA carries
// the draft to /api/invitations (source='scriptmaker'). DRAFTS ONLY — no
// mint, no send (Chat #118 boundary). Gated (requireAuth +
// requireMichaelComplete) inside the route. Degrades to a neutral fallback
// when ANTHROPIC_API_KEY is unset (dormant today).
app.use('/api/scriptmaker', scriptmakerRoutes);

// Fast Start Training (feat/fast-start-training, wireframe 3.5).
// GET /fast-start/progress + GET-1 whitelisted pre-Michael in
// MICHAEL_GATE_WHITELIST; POST .../modules/2-5/state stay gated.
// Sequential UI, not hard-gated (TASK.md open-question answer).
app.use('/api/training', trainingRoutes);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(env.SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[momentum-server] listening on :${env.SERVER_PORT} (${env.NODE_ENV}) — admin BA IDs configured: ${env.ADMIN_BA_IDS.length}`,
  );
});

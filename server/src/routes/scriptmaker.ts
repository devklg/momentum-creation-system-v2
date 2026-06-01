/**
 * POST /api/scriptmaker/draft — ScriptMaker draft route (Chat #122).
 *
 * The video-library front door's server endpoint. A BA who just watched a
 * product video asks ScriptMaker for a personalized invitation draft
 * anchored to that product; the BA reviews/edits it, then it flows into the
 * /invitations spine via the seed + source='scriptmaker' seam (Chat #120).
 *
 * BOUNDARY (Chat #118): this route DRAFTS only. It does not mint a token,
 * create a prospect, or send anything — those stay in the invitation spine.
 * The draft is returned to the client; the BA carries it to /invitations.
 *
 * Gating: requireAuth + requireMichaelComplete (BA-facing gated routes per
 * index.ts canonical pattern), same as the spine. A BA cannot draft until
 * Michael onboarding is complete.
 *
 * Sponsor immutability (locked-spec 3.5): not directly relevant here since
 * no record is written, but the route still derives identity from the
 * session (requireAuth) and reads nothing identity-bearing from the body.
 *
 * Compliance (locked-spec 3.11): script-time enforcement lives in
 * domain/scriptmaker.ts — the system prefix forbids income/placement/comp/
 * medical claims. This route is the transport; the domain is the gate.
 *
 * Degraded mode: when ANTHROPIC_API_KEY is unset (dormant today), the
 * domain returns a neutral fallback draft with degraded=true and a 200 —
 * the surface works before the key lands, mirroring the Resend pattern.
 */

import { Router } from 'express';
import type {
  ScriptMakerDraftPayload,
  ScriptMakerDraftResponse,
  ScriptMakerDraftSelectors,
  ScriptMakerScriptKind,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import { draftInvitation } from '../domain/scriptmaker.js';

const SCRIPT_KINDS: ReadonlySet<ScriptMakerScriptKind> = new Set([
  'default_script',
  'product_anchored',
  'reconnect',
  'event_invite',
]);

/** Resolve the optional scriptKind selector; defaults to product_anchored. */
function resolveScriptKind(raw: unknown): ScriptMakerScriptKind {
  return typeof raw === 'string' && SCRIPT_KINDS.has(raw as ScriptMakerScriptKind)
    ? (raw as ScriptMakerScriptKind)
    : 'product_anchored';
}

export const scriptmakerRoutes: Router = Router();

/** Trim a required string; return '' when absent so the caller can 400. */
function requiredStr(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Trim an optional string; return null when empty/absent. */
function optionalStr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

const PRODUCT_MAX = 120;
const TITLE_MAX = 200;
const NAME_MAX = 80;
const CONTEXT_MAX = 600;

/**
 * POST /api/scriptmaker/draft
 * Returns 200 with the drafted message (degraded=true when the LLM was
 * unavailable and a neutral fallback was used). 400 on validation failure.
 */
scriptmakerRoutes.post(
  '/draft',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }

    const body = req.body as Partial<
      ScriptMakerDraftPayload & ScriptMakerDraftSelectors
    >;
    const productName = requiredStr(body?.productName);
    const videoTitle = requiredStr(body?.videoTitle);
    const prospectFirstName = requiredStr(body?.prospectFirstName);
    const prospectContext = optionalStr(body?.prospectContext);
    const scriptKind = resolveScriptKind(body?.scriptKind);
    const eventDay = optionalStr(body?.eventDay);
    const eventTime = optionalStr(body?.eventTime);

    if (!productName || productName.length > PRODUCT_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_product' });
    }
    if (!videoTitle || videoTitle.length > TITLE_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_video_title' });
    }
    if (!prospectFirstName || prospectFirstName.length > NAME_MAX) {
      return res
        .status(400)
        .json({ ok: false, error: 'invalid_prospect_first_name' });
    }
    if (prospectContext && prospectContext.length > CONTEXT_MAX) {
      return res.status(400).json({ ok: false, error: 'context_too_long' });
    }

    try {
      const result = await draftInvitation({
        productName,
        videoTitle,
        prospectFirstName,
        prospectContext,
        scriptKind,
        eventDay,
        eventTime,
      });
      const response: ScriptMakerDraftResponse = {
        ok: true,
        draft: result.draft,
        productName,
        prospectFirstName,
        degraded: result.degraded,
      };
      return res.status(200).json(response);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[POST /api/scriptmaker/draft] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

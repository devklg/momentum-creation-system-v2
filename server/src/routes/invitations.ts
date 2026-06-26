/**
 * POST /api/invitations — the invitation spine route (Chat #119).
 *
 * The BA-facing WRITE endpoint that mints a prospect + invite-token and
 * returns the substituted https://teammagnificent.com/p/{token} link the BA
 * shares. This is the "production line" per locked-spec 1.8 — the highest-
 * leverage action a BA takes; nothing else they do matters until they can
 * mint and send a link.
 *
 * Routes:
 *   POST /api/invitations               mint a new invitation (state 'minted')
 *   POST /api/invitations/:id/sent       "I sent this" — set sentAt (FIELD)
 *   POST /api/invitations/log            standalone "log an invite I sent" (G.5)
 *
 * Gating: requireAuth + requireSteveComplete (BA-facing gated routes per
 * index.ts canonical pattern). A BA cannot mint invitations until Michael
 * onboarding is complete.
 *
 * Sponsor immutability (locked-spec 3.5): sponsorBaId is read from
 * req.session.baId — the authed session — NEVER from the request body. Any
 * sponsorBaId in the body is ignored. This is enforced here at the route
 * layer, the single point where the session identity is authoritative.
 *
 * Compliance (locked-spec 3.10, 1.13): the spine mints the link; it does NOT
 * send anything to the prospect. The BA sends the link from their own phone
 * (word-of-mouth channel protection). The only SMS the system sends is the
 * BA-facing alert when a prospect completes the video — wired in the
 * video-event route, not here.
 */

import { Router } from 'express';
import type {
  CreateInvitationPayload,
  CreateInvitationResponse,
  InvitationSource,
  MarkInvitationSentResponse,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  createInvitation,
  logExternalInvite,
  markInvitationSent,
  type CreateInvitationInput,
} from '../domain/invitations.js';
import { normalizePhone } from '../domain/prospectAccount.js';

export const invitationRoutes: Router = Router();

/** Trim a string field; return null for empty/absent. */
function optionalStr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/** Trim a required string field; return '' if absent so the caller can 400. */
function requiredStr(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

const INVITATION_SOURCES: readonly InvitationSource[] = [
  'self',
  'ivory',
  'scriptmaker',
];

/** Validate the source marker; default to 'self' (the plain form). */
function normalizeSource(raw: unknown): InvitationSource {
  return INVITATION_SOURCES.includes(raw as InvitationSource)
    ? (raw as InvitationSource)
    : 'self';
}

/** Max stored invitation message length — generous for SMS-length drafts. */
const MESSAGE_MAX = 1200;
const RELATIONSHIP_REASON_MAX = 600;

/**
 * Build the domain input from the request body + the authed session BA.
 * sponsorBaId comes from the session ONLY (locked-spec 3.5). Returns a
 * validation error string, or the input object.
 */
function buildInput(
  body: Partial<CreateInvitationPayload>,
  sponsorBaId: string,
): { error: string } | { input: CreateInvitationInput } {
  const firstName = requiredStr(body?.firstName);
  const lastName = requiredStr(body?.lastName);
  const city = requiredStr(body?.city);
  const stateOrRegion = requiredStr(body?.stateOrRegion);

  // Chat #119 field lock: first/last name + city/state are required (city/
  // state feed the ticker + CRM export). email + phone are captured but
  // optional at mint — the BA may not have both for every warm-market name.
  if (!firstName || firstName.length > 80) return { error: 'invalid_first_name' };
  if (!lastName || lastName.length > 80) return { error: 'invalid_last_name' };
  if (!city || city.length > 120) return { error: 'invalid_city' };
  if (!stateOrRegion || stateOrRegion.length > 120) {
    return { error: 'invalid_state' };
  }

  const country = optionalStr(body?.country) ?? 'US';

  // Chat #120: invitation message is stored for reuse + history (NOT sent
  // by the system). Optional at the spine level so /log stays compatible;
  // the plain form always supplies it. Cap defensively.
  const message = optionalStr(body?.message);
  if (message && message.length > MESSAGE_MAX) {
    return { error: 'message_too_long' };
  }
  const source = normalizeSource(body?.source);
  const relationshipReason = optionalStr(body?.relationshipReason);
  if (relationshipReason && relationshipReason.length > RELATIONSHIP_REASON_MAX) {
    return { error: 'relationship_reason_too_long' };
  }

  return {
    input: {
      sponsorBaId,
      firstName,
      lastName,
      email: optionalStr(body?.email),
      phone: optionalStr(body?.phone),
      city,
      stateOrRegion,
      country,
      message,
      source,
      relationshipReason,
    },
  };
}

/**
 * POST /api/invitations — mint a new invitation.
 * Returns 201 with the substituted prospect link.
 */
invitationRoutes.post('/', requireAuth, requireSteveComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const built = buildInput(req.body as Partial<CreateInvitationPayload>, sponsorBaId);
  if ('error' in built) {
    return res.status(400).json({ ok: false, error: built.error });
  }

  // Chat #125: phone is REQUIRED on the mint route. The BA sends the invite
  // by SMS from their own phone (locked-spec 1.13, 3.6) — a prospect with no
  // number cannot receive the link, so the phone is the delivery channel,
  // not optional contact metadata. This corrects the Chat #119 "phone
  // optional" call. Enforced here (mint only) rather than in buildInput so
  // the /log retroactive-record path stays lenient.
  if (!built.input.phone) {
    return res.status(400).json({ ok: false, error: 'phone_required' });
  }
  // #148: phone must normalize to E.164 so the prospect-account row created
  // at mint carries a usable login key (phone + re-entry code). Reject
  // un-parseable numbers here rather than silently minting an account the
  // prospect can never log into.
  if (!normalizePhone(built.input.phone)) {
    return res.status(400).json({ ok: false, error: 'phone_invalid' });
  }

  try {
    const result = await createInvitation(built.input);
    const response: CreateInvitationResponse = {
      ok: true,
      prospectId: result.prospectId,
      token: result.token,
      inviteUrl: result.inviteUrl,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      message: result.message,
      source: result.source,
      relationshipReason: result.relationshipReason,
    };
    return res.status(201).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/invitations] mint failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * POST /api/invitations/:prospectId/sent — "I sent this."
 * Sets sentAt (FIELD, not lifecycle state) + writes the activity entry.
 * Idempotent. Sponsor-guarded: the session BA must own the prospect.
 */
invitationRoutes.post(
  '/:prospectId/sent',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = Array.isArray(req.params.prospectId)
      ? req.params.prospectId[0]
      : req.params.prospectId;
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    try {
      const result = await markInvitationSent(prospectId, sponsorBaId);
      const response: MarkInvitationSentResponse = {
        ok: true,
        prospectId,
        sentAt: result.sentAt,
        alreadySent: result.alreadySent,
      };
      return res.status(200).json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'server_error';
      if (message === 'prospect_not_found') {
        return res.status(404).json({ ok: false, error: 'prospect_not_found' });
      }
      if (message === 'sponsor_mismatch') {
        // A BA tried to act on a prospect that isn't theirs. 403, not 404,
        // so the cockpit can distinguish "not yours" from "doesn't exist"
        // — but the message stays generic to avoid leaking other BAs' data.
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/invitations/:prospectId/sent] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

/**
 * POST /api/invitations/log — standalone "log an invite I sent" (G.5).
 * Mints prospect + token AND marks sent in one call, for a BA recording an
 * invite they shared outside the normal mint-then-confirm flow.
 * Returns 201 with the same link payload as the mint route.
 */
invitationRoutes.post('/log', requireAuth, requireSteveComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const built = buildInput(req.body as Partial<CreateInvitationPayload>, sponsorBaId);
  if ('error' in built) {
    return res.status(400).json({ ok: false, error: built.error });
  }

  try {
    const result = await logExternalInvite(built.input);
    const response: CreateInvitationResponse = {
      ok: true,
      prospectId: result.prospectId,
      token: result.token,
      inviteUrl: result.inviteUrl,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      message: result.message,
      source: result.source,
      relationshipReason: result.relationshipReason,
    };
    return res.status(201).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/invitations/log] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

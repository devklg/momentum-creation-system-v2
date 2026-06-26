/**
 * /api/profile/* — the BA's own profile / settings surface (wireframe 3.8).
 *
 * All routes scoped to the authed session BA (locked-spec 3.5). The BA ID
 * is read from req.session.baId and NEVER from a body/param. No route on
 * this file accepts sponsor / tmBaId / threeBaId / accessCodeHeld in a
 * mutation body — those fields are read-only by spec (2.3, 3.5) and the
 * zod schemas use .strict() so any attempt to send them is rejected.
 *
 * Gating: requireAuth + requireSteveComplete (BA-facing gated routes per
 * server/src/index.ts canonical pattern). /api/profile is also whitelisted
 * in requireSteveComplete's whitelist so a BA who's mid-onboarding can still update
 * their timezone/photo — but requireAuth is still enforced.
 *
 * J.8 (phone change verification) is RESOLVED (Chat #147, seq 22): NO SMS code.
 * The .team client confirms the typed number in a modal (restating it + why it
 * matters) and POSTs to /phone, which applies the change directly. Email keeps
 * its two-step code challenge (proving access to a new inbox is a different
 * problem from confirming a number you typed).
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  getProfileForBA,
  patchProfile,
  changePassword,
  startEmailChange,
  completeEmailChange,
  setPhone,
} from '../domain/profile.js';
import type { ProfileGetResponse } from '@momentum/shared';

export const profileRoutes: Router = Router();

const ChannelMix = z
  .object({
    sms: z.boolean(),
    email: z.boolean(),
    inApp: z.boolean(),
  })
  .strict();

const NotifPrefsPatch = z
  .object({
    callbackRequested: ChannelMix.optional(),
    webinarReserved: ChannelMix.optional(),
    newSponsoredBA: ChannelMix.optional(),
    steveDiscoveryComplete: ChannelMix.optional(),
    poolMovement: ChannelMix.optional(),
  })
  .strict();

const PatchBody = z
  .object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    timezone: z.string().min(3).max(80).optional(),
    photoUrl: z.union([z.string().url().max(2048), z.null()]).optional(),
    notifPrefs: NotifPrefsPatch.optional(),
  })
  .strict();

const PasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .strict();

const EmailStartBody = z
  .object({ newEmail: z.string().email().max(320) })
  .strict();

const EmailVerifyBody = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .strict();

const PhoneSetBody = z
  .object({ newPhone: z.string().min(7).max(40) })
  .strict();

profileRoutes.get('/', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const profile = await getProfileForBA(baId);
    if (!profile) return res.status(404).json({ ok: false, error: 'profile_not_found' });
    const payload: ProfileGetResponse = { ok: true, profile };
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/profile] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

profileRoutes.patch('/', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_patch' });
  }

  try {
    const profile = await patchProfile(baId, parsed.data);
    const payload: ProfileGetResponse = { ok: true, profile };
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PATCH /api/profile] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

profileRoutes.post('/password', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const parsed = PasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_password_body' });
  }

  try {
    const result = await changePassword(
      baId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/profile/password] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

profileRoutes.post('/email/start', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const parsed = EmailStartBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  try {
    const result = await startEmailChange(baId, parsed.data.newEmail.trim().toLowerCase());
    return res.status(200).json({ ok: true, deliveryStatus: result.deliveryStatus });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/profile/email/start] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

profileRoutes.post('/email/verify', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const parsed = EmailVerifyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_code' });
  }

  try {
    const result = await completeEmailChange(baId, parsed.data.code);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/profile/email/verify] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// J.8 (Chat #147, seq 22): direct phone set — NO SMS code. The client confirms
// the typed number in a modal, then POSTs here. requireAuth ensures it's the
// session BA; the domain audits the swap.
profileRoutes.post('/phone', requireAuth, requireSteveComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const parsed = PhoneSetBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_phone' });
  }

  try {
    const result = await setPhone(baId, parsed.data.newPhone.trim());
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/profile/phone] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

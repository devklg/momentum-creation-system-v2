import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { findAccessCode } from '../domain/access-codes.js';
import { emailExists, threeBaIdExists, registerBA } from '../domain/ba.js';
import { signSession, setSessionCookie } from '../services/session.js';
import { env } from '../env.js';

export const authRoutes: Router = express.Router();

const VerifyBody = z.object({ code: z.string().min(2).max(32) });

authRoutes.post('/verify-code', async (req: Request, res: Response) => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid request' });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  try {
    const rec = await findAccessCode(code);
    if (!rec) {
      res.json({ ok: false, error: 'Code not recognized. Check with your sponsor.' });
      return;
    }
    res.json({
      ok: true,
      sponsor: {
        name: `${rec.sponsorFirstName} ${rec.sponsorLastName}`,
        threeBaId: rec.sponsorThreeBaId,
        tmCode: rec.code,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Server error: ${msg}` });
  }
});

const RegisterBody = z.object({
  accessCode: z.string().min(2).max(32),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(40),
  threeUsername: z.string().min(1).max(80),
  threeBaId: z.string().min(1).max(40),
  password: z.string().min(8).max(200),
  termsAccepted: z.literal(true),
});

authRoutes.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input. Please check the form and try again.' });
    return;
  }
  const input = parsed.data;

  try {
    const sponsor = await findAccessCode(input.accessCode.trim().toUpperCase());
    if (!sponsor) {
      res.status(400).json({ ok: false, error: 'Access code is not valid.' });
      return;
    }

    const email = input.email.trim().toLowerCase();
    if (await emailExists(email)) {
      res.status(409).json({ ok: false, error: 'An account with that email already exists.' });
      return;
    }
    if (await threeBaIdExists(input.threeBaId.trim())) {
      res.status(409).json({ ok: false, error: 'That THREE BA ID is already registered.' });
      return;
    }

    const ba = await registerBA(
      {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone.trim(),
        threeUsername: input.threeUsername.trim(),
        threeBaId: input.threeBaId.trim(),
        passwordPlain: input.password,
      },
      sponsor,
    );

    const token = await signSession(
      { baId: ba.baId, threeBaId: ba.threeBaId, email: ba.email },
      env.JWT_TTL_REMEMBER_DAYS,
    );
    setSessionCookie(res, token);

    res.json({ ok: true, baId: ba.baId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Registration failed: ${msg}` });
  }
});

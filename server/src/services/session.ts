import { SignJWT, jwtVerify } from 'jose';
import type { CookieOptions, Response } from 'express';
import { env } from '../env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionClaims {
  baId: string;
  threeBaId: string;
  email: string;
}

export async function signSession(claims: SessionClaims, ttlDays: number): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env.JWT_TTL_REMEMBER_DAYS * 24 * 60 * 60 * 1000,
    ...(env.NODE_ENV === 'production' ? { domain: env.JWT_COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.JWT_COOKIE_NAME, token, cookieOptions());
}

/**
 * Clear the session cookie. Used by POST /api/auth/logout.
 * Safe to call when no cookie is set — Express just emits an expired Set-Cookie.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(env.NODE_ENV === 'production' ? { domain: env.JWT_COOKIE_DOMAIN } : {}),
  });
}

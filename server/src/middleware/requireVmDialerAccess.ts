import type { NextFunction, Request, Response } from 'express';
import { findBAByTmagId } from '../domain/ba.js';
import { hasVmDialerEntitlement } from '../domain/entitlements.js';

export async function requireVmDialerAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }

  const ba = await findBAByTmagId(tmagId);
  if (!ba || !hasVmDialerEntitlement((ba as unknown as { entitlements?: unknown }).entitlements)) {
    res.status(403).json({ ok: false, error: 'VM_DIALER_NOT_ENABLED' });
    return;
  }

  next();
}

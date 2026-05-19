import type { Request, Response, Router } from 'express';
import express from 'express';
import { gatewayCall } from '../services/gateway.js';

export const healthRoutes: Router = express.Router();

healthRoutes.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'momentum-creation-system', ts: new Date().toISOString() });
});

healthRoutes.get('/gateway', async (_req: Request, res: Response) => {
  try {
    // Lightweight gateway ping — ask mongodb for its server info.
    await gatewayCall('mongodb', 'ping', {});
    res.json({ ok: true, gateway: 'reachable' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ ok: false, gateway: 'unreachable', error: message });
  }
});

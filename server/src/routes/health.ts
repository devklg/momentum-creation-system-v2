import type { Request, Response, Router } from 'express';
import express from 'express';
import { directPersistenceHealth } from '../services/persistence/index.js';

export const healthRoutes: Router = express.Router();

healthRoutes.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'momentum-creation-system', ts: new Date().toISOString() });
});

// Per-leg DIRECT persistence health (ACR-0007 / ACR-0009). Replaces the
// retired /PERSISTENCE probe — the runtime has no external MCP tool server dependency to
// probe. Reports the persistence-mode snapshot plus a live health check for
// every store in direct mode (and the GPU embedder for the Chroma leg).
healthRoutes.get('/persistence', async (_req: Request, res: Response) => {
  try {
    const health = await directPersistenceHealth();
    const legs = Object.values(health.stores);
    const ok = legs.length > 0 && legs.every(Boolean);
    res.status(ok ? 200 : 503).json({ ok, ...health });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ ok: false, error: message });
  }
});

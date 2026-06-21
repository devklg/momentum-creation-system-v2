/**
 * /api/agents - orchestration layer over existing BA-facing agent surfaces.
 *
 * This route does not implement Michael, Ivory, or Steve logic. It composes
 * their existing read models into a small recommendation feed and records
 * append-only interaction events for observability.
 */

import { Router } from 'express';
import type {
  AgentEventResponse,
  AgentRecommendationsResponse,
  CreateAgentEventPayload,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  AgentEventValidationError,
  getAgentRecommendations,
  recordAgentEvent,
} from '../domain/agents/orchestrator.js';

export const agentRoutes: Router = Router();

agentRoutes.get(
  '/recommendations',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const payload: AgentRecommendationsResponse =
        await getAgentRecommendations(baId);
      return res.status(200).json(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/agents/recommendations] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

agentRoutes.post(
  '/events',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const event = await recordAgentEvent(
        baId,
        (req.body ?? {}) as CreateAgentEventPayload,
      );
      const payload: AgentEventResponse = { ok: true, event };
      return res.status(201).json(payload);
    } catch (err) {
      if (err instanceof AgentEventValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/agents/events] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

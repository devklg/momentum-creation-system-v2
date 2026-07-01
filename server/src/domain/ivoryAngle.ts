import type { IvoryAngle } from '@momentum/shared';

/**
 * Canonical human label per Ivory angle — the single source of truth shared by
 * the coach (ivory.ts) and momentum (ivory-momentum.ts) prompt builders so the
 * same angle can never be described two different ways to the LLM. Phrased as an
 * interest-noun so it reads naturally in every call site ("interested in X",
 * "chosen angle for this person: X").
 */
export const ANGLE_LABEL: Record<IvoryAngle, string> = {
  do_the_business: 'building the business with you',
  make_money: 'a real way to make money',
  lose_fat: 'losing fat or feeling better',
  unspecified: 'what might fit them',
};

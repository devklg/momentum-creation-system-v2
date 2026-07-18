import { KongaLineView } from '@momentum/konga-ui';
import {
  type McsKongaLineLens,
  type McsWebinarEvent,
} from '@momentum/shared';
import type { PlacementStreamState } from '@/lib/usePlacementStream';

interface KongaLineProps {
  lens: McsKongaLineLens;
  sponsorFullName: string;
  viewer: { firstName: string; positionNumber: number; placedAt: string };
  stream: PlacementStreamState;
  nextWebinar: McsWebinarEvent | {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
}

/**
 * COM adapter: preserves the Lane B call surface while the neutral renderer
 * remains free of token-route and PlacementStreamState dependencies.
 */
export function KongaLine(props: KongaLineProps) {
  return <KongaLineView {...props} />;
}

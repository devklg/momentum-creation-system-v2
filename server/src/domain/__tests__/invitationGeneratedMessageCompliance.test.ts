import { describe, expect, it } from 'vitest';
import {
  createInvitation,
  InvitationComplianceError,
} from '../invitations.js';

describe('invitation spine generated-source compliance', () => {
  it('rejects ScriptMaker/Ivory sourced messages before minting or persistence', async () => {
    await expect(
      createInvitation({
        sponsorTmagId: 'TMAG-1',
        firstName: 'Dana',
        lastName: 'Smith',
        email: null,
        phone: '2125551234',
        city: 'Dallas',
        stateOrRegion: 'TX',
        country: 'US',
        message:
          'This can make $500, produce CV cycles, and lock your spillover spot.',
        source: 'scriptmaker',
        relationshipReason: null,
      }),
    ).rejects.toBeInstanceOf(InvitationComplianceError);
  });
});

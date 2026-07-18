import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KongaLineView, type KongaLineConnectionState } from './KongaLineView';

const placedAt = '2026-07-17T18:00:00.000Z';

function connectedStream(): KongaLineConnectionState {
  return {
    connecting: false,
    connected: true,
    errored: false,
    ticker: [{
      positionNumber: 42,
      firstName: 'Avery',
      lastInitial: 'Q',
      city: 'Austin',
      stateOrRegion: 'TX',
      placedAt,
      addedBy: { firstName: 'Paul', lastInitial: 'B' },
    }],
    latestArrival: {
      contractVersion: 'konga-v1',
      eventId: 'placement-42',
      positionNumber: 42,
      firstName: 'Avery',
      lastInitial: 'Q',
      city: 'Austin',
      stateOrRegion: 'TX',
      placedAt,
      addedBy: { firstName: 'Paul', lastInitial: 'B' },
    },
    latestJoin: {
      contractVersion: 'konga-v1',
      eventId: 'join-42',
      positionNumber: 42,
      firstName: 'Avery',
      lastInitial: 'Q',
      city: 'Austin',
      stateOrRegion: 'TX',
      addedBy: { firstName: 'Paul', lastInitial: 'B' },
      joinedAt: '2026-07-17T18:30:00.000Z',
    },
  };
}

describe('KongaLineView', () => {
  it('preserves the minimized sponsor, attribution, live region, and mute behavior', () => {
    render(
      <KongaLineView
        lens={{ head: 'sponsor' }}
        sponsorFullName="Kevin Gardner"
        viewer={{ firstName: 'Jordan', positionNumber: 41, placedAt }}
        stream={connectedStream()}
        nextWebinar={null}
      />,
    );

    expect(screen.getByText('Kevin G.')).toBeInTheDocument();
    expect(screen.getByText('added by Paul B.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Joined');
    expect(screen.getByText('No samples. No simulated activity.')).toBeInTheDocument();

    const mute = screen.getByRole('button', { name: 'Mute sound' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(mute);
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/activates safely after your first interaction/i)).not.toBeInTheDocument();
  });

  it('keeps hover/focus pause and blanket reduced-motion protection in shared CSS', () => {
    const css = readFileSync(
      path.join(process.cwd(), 'src', 'konga-line.css'),
      'utf8',
    );

    expect(css).toContain('.konga-line-shell:hover .konga-belt');
    expect(css).toContain('.konga-line-shell:focus-within .konga-belt');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.konga-line-shell *::after');
    expect(css).toContain('animation: none !important;');
    expect(css).toContain('transition: none !important;');
  });

  it('renders the Team self lens from a confirmed genesis without inventing a BA position', () => {
    render(
      <KongaLineView
        lens={{ head: 'self' }}
        sponsorFullName=""
        viewer={{
          firstName: 'Kevin',
          positionNumber: null,
          placedAt: null,
          genesis: {
            prospectId: 'prospect-1',
            firstName: 'Jordan',
            lastInitial: 'R',
            city: 'Pasadena',
            stateOrRegion: 'CA',
            invitedAt: placedAt,
            positionNumber: null,
            sourceAuthority: 'invitation_activity.invitation_sent',
          },
        }}
        stream={connectedStream()}
        nextWebinar={null}
      />,
    );

    expect(screen.getByText('Kevin')).toBeInTheDocument();
    expect(screen.getByText('Your first invite · genesis')).toBeInTheDocument();
    expect(screen.getByText('Jordan R.')).toBeInTheDocument();
    expect(screen.queryByText(/YOU · Kevin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Position /i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Avery Q.')).toHaveLength(2);
  });
});

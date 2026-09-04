import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MCS_KONGA_TICKER_WINDOW } from '@momentum/shared';
import { KongaLineView, countLine, type KongaLineConnectionState } from './KongaLineView';

const placedAt = '2026-07-17T18:00:00.000Z';

function tickerEntry(pos: number) {
  return {
    positionNumber: pos,
    firstName: `P${pos}`,
    lastInitial: 'X',
    city: 'Austin',
    stateOrRegion: 'TX',
    placedAt: `2026-07-17T18:00:${String(pos % 60).padStart(2, '0')}.000Z`,
    addedBy: { firstName: 'Paul', lastInitial: 'B' },
  };
}

/** newest-first ticker of `count` entries, positions descending from globalMaxPosition. */
function cardStream(count: number, globalMaxPosition: number): KongaLineConnectionState {
  return {
    connecting: false,
    connected: true,
    errored: false,
    globalMaxPosition,
    ticker: Array.from({ length: count }, (_, i) => tickerEntry(globalMaxPosition - i)),
    latestArrival: null,
    latestJoin: null,
  };
}

function renderCard(count: number, globalMaxPosition: number, positionNumber: number, nextWebinar: { eventId: string; scheduledFor: string; hosts: string[] } | null = null) {
  return render(
    <KongaLineView
      lens={{ head: 'sponsor' }}
      sponsorFullName="Kevin Gardner"
      viewer={{ firstName: 'Jordan', positionNumber, placedAt }}
      stream={cardStream(count, globalMaxPosition)}
      nextWebinar={nextWebinar}
    />,
  );
}

describe('KongaCard', () => {
  it('renders min(entries, 100) real rows with no placeholder/ghost rows', () => {
    for (const [count, expected] of [[0, 0], [3, 3], [60, 60], [150, MCS_KONGA_TICKER_WINDOW]] as const) {
      // viewer position 1 is far below the generated window so nothing is self-filtered.
      const { container, unmount } = renderCard(count, 100_000, 1);
      expect(container.querySelectorAll('.konga-ticker-list .konga-node')).toHaveLength(expected);
      expect(container.querySelectorAll('.konga-open-slot')).toHaveLength(0);
      if (count === 0) {
        expect(container.querySelector('.konga-honest-empty')).not.toBeNull();
      }
      unmount();
    }
  });

  it('newest arrival is rendered at the back (bottom) of the line', () => {
    const { container } = renderCard(3, 100, 1);
    const rows = Array.from(container.querySelectorAll('.konga-ticker-list .konga-node strong'));
    // globalMaxPosition 100 is newest → must be the last (bottom) row.
    expect(rows[rows.length - 1]?.textContent).toBe('P100 X.');
  });

  it('shows the number = globalMaxPosition - positionNumber and the verbatim count line', () => {
    const { container } = renderCard(5, 100, 40);
    expect(container.querySelector('.konga-card-number-value')?.textContent).toBe('60');
    expect(screen.getByText(countLine(60))).toBeInTheDocument();
    expect(countLine(60)).toBe('60 people like you have been exposed to this opportunity since you arrived.');
  });

  it('uses the singular count line at exactly 1', () => {
    renderCard(1, 42, 41);
    expect(
      screen.getByText('1 person like you has been exposed to this opportunity since you arrived.'),
    ).toBeInTheDocument();
    expect(countLine(1)).toBe('1 person like you has been exposed to this opportunity since you arrived.');
  });

  it('collapses the countdown when there is no webinar, and shows it when there is', () => {
    const withoutWebinar = renderCard(3, 100, 1, null);
    expect(withoutWebinar.container.querySelector('.konga-countdown-grid')).toBeNull();
    withoutWebinar.unmount();

    const withWebinar = renderCard(3, 100, 1, {
      eventId: 'evt-1',
      scheduledFor: '2099-01-01T00:00:00.000Z',
      hosts: ['Kevin'],
    });
    expect(withWebinar.container.querySelector('.konga-countdown-grid')).not.toBeNull();
  });
});

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

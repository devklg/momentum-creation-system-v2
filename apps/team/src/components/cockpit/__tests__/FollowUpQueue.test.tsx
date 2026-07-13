import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FollowUpQueue } from '../FollowUpQueue';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('P2-107 FollowUpQueue', () => {
  it('renders cross-source counts, manual ownership, and routes each identity correctly', async () => {
    fetchMock.mockResolvedValue(response({
      ok: true,
      generatedAt: '2026-07-13T20:00:00.000Z',
      manualOnly: true,
      counts: { total: 2, raisedHands: 1, overdue: 1, upcoming: 0 },
      items: [
        {
          id: 'cb1', entityKind: 'vm_lead', entityId: 'l1', firstName: 'Cara', lastInitial: 'L',
          reason: 'callback_request', status: 'raised_hand', source: 'vm_rvm', intent: 'interested_tell_me_more',
          signaledAt: '2026-07-13T19:00:00.000Z', dueAt: null, href: '/vm-campaigns',
        },
        {
          id: 'fu1', entityKind: 'prospect', entityId: 'p1', firstName: 'Ana', lastInitial: 'J',
          reason: 'crm_reminder', status: 'overdue', source: 'prospect_crm', intent: null,
          signaledAt: null, dueAt: '2026-07-12T20:00:00.000Z', href: '/cockpit#invite-p1',
        },
      ],
    }));
    const onProspect = vi.fn();
    const onVmLead = vi.fn();

    render(<FollowUpQueue onProspect={onProspect} onVmLead={onVmLead} />);

    expect(await screen.findByText('Unified Follow-up Queue')).toBeInTheDocument();
    expect(screen.getByText(/you decide and make every contact/i)).toBeInTheDocument();
    expect(screen.getByText('1 raised')).toBeInTheDocument();
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    expect(screen.getByText('VM / RVM')).toBeInTheDocument();
    expect(screen.getByText('Prospect CRM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cara L\./i }));
    expect(onVmLead).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Ana J\./i }));
    expect(onProspect).toHaveBeenCalledWith('p1');
  });

  it('renders the approved bias prompt when nothing is waiting', async () => {
    fetchMock.mockResolvedValue(response({
      ok: true, generatedAt: '2026-07-13T20:00:00.000Z', manualOnly: true,
      counts: { total: 0, raisedHands: 0, overdue: 0, upcoming: 0 }, items: [],
    }));

    render(<FollowUpQueue onProspect={vi.fn()} onVmLead={vi.fn()} />);
    expect(await screen.findByText(/who are you sharing with today/i)).toBeInTheDocument();
  });

  it('surfaces unavailable state instead of claiming the queue is empty', async () => {
    fetchMock.mockResolvedValue(response({}, false));
    render(<FollowUpQueue onProspect={vi.fn()} onVmLead={vi.fn()} />);
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/no follow-up is waiting/i)).not.toBeInTheDocument();
  });
});

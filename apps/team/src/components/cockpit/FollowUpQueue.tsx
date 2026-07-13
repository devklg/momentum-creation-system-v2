/** P2-107 — one human-owned queue across Prospect CRM and VM/RVM. */

import { useCallback, useEffect, useState } from 'react';

type QueueItem = {
  id: string;
  entityKind: 'prospect' | 'vm_lead';
  entityId: string;
  firstName: string;
  lastInitial: string;
  reason: 'callback_request' | 'crm_reminder';
  status: 'raised_hand' | 'overdue' | 'upcoming';
  source: 'prospect_crm' | 'vm_rvm';
  intent: 'interested_tell_me_more' | 'have_questions' | 'ready_to_join' | null;
  signaledAt: string | null;
  dueAt: string | null;
  href: string;
};

type QueueResponse = {
  ok: true;
  generatedAt: string;
  manualOnly: true;
  counts: { total: number; raisedHands: number; overdue: number; upcoming: number };
  items: QueueItem[];
};

type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; queue: QueueResponse };

export function FollowUpQueue({
  onProspect,
  onVmLead,
}: {
  onProspect: (prospectId: string) => void;
  onVmLead: () => void;
}) {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/cockpit/follow-up-queue', { credentials: 'include' });
      if (!response.ok) return setView({ kind: 'error' });
      setView({ kind: 'ready', queue: (await response.json()) as QueueResponse });
    } catch {
      setView({ kind: 'error' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section id="follow-up-queue" className="mt-8 border border-gold/20 rounded-md bg-cream/[0.02] overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4 border-b border-cream/10">
        <div>
          <p className="font-mono tracking-[0.18em] text-[11px] text-gold uppercase mb-1">
            Unified Follow-up Queue
          </p>
          <p className="text-cream-faint text-[13px]">
            Raised hands and reminders from Prospect CRM and VM/RVM. You decide and make every contact.
          </p>
        </div>
        {view.kind === 'ready' && (
          <div className="flex gap-3 font-mono text-[11px] text-cream-faint">
            <span>{view.queue.counts.raisedHands} raised</span>
            <span>{view.queue.counts.overdue} overdue</span>
            <span>{view.queue.counts.upcoming} upcoming</span>
          </div>
        )}
      </div>

      {view.kind === 'loading' && <QueueMessage>Loading follow-up context…</QueueMessage>}
      {view.kind === 'error' && (
        <div className="px-5 py-5 flex items-center justify-between gap-4">
          <span className="text-red-300 text-[13px]">Follow-up context is temporarily unavailable.</span>
          <button type="button" onClick={() => void load()} className="text-gold text-[12px] underline">Retry</button>
        </div>
      )}
      {view.kind === 'ready' && view.queue.items.length === 0 && (
        <QueueMessage>No follow-up is waiting. Who are you sharing with today?</QueueMessage>
      )}
      {view.kind === 'ready' && view.queue.items.length > 0 && (
        <ul className="divide-y divide-cream/10">
          {view.queue.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => item.entityKind === 'prospect' ? onProspect(item.entityId) : onVmLead()}
                className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-cream/[0.03] transition-colors"
              >
                <StatusPill status={item.status} />
                <span className="flex-1 min-w-0">
                  <span className="text-cream text-[14px]">{item.firstName} {item.lastInitial ? `${item.lastInitial}.` : ''}</span>
                  <span className="ml-2 text-cream-faint text-[12px]">
                    {item.reason === 'callback_request' ? 'asked for a conversation' : 'follow-up reminder'}
                  </span>
                </span>
                <span className="hidden sm:block text-right shrink-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
                    {item.source === 'vm_rvm' ? 'VM / RVM' : 'Prospect CRM'}
                  </span>
                  <span className="block font-mono text-[10px] text-cream-faint mt-1">
                    {formatDate(item.dueAt ?? item.signaledAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-cream-faint text-[13px]">{children}</p>;
}

function StatusPill({ status }: { status: QueueItem['status'] }) {
  const style = status === 'raised_hand'
    ? 'border-gold/40 bg-gold/[0.08] text-gold'
    : status === 'overdue'
      ? 'border-red-400/40 bg-red-400/[0.06] text-red-300'
      : 'border-teal/40 bg-teal/[0.06] text-teal';
  return (
    <span className={`font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 rounded border shrink-0 ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

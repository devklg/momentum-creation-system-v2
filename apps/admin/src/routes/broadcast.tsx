/**
 * /broadcast — ADMIN Section G composer page (Chat #144).
 *
 * Composes:
 *   • ChannelSelector       (G.3) — sms | email | both
 *   • AudienceSelector      (G.2) — preset + live count, STOP-aware
 *   • Composer              (G.1) — template + interpolation preview
 *   • SendTestButton        (G.4) — one-shot test to Kevin
 *   • Submit master broadcast (G.5) — enqueues, then mounts BroadcastStatus
 *   • Recent broadcasts list — quick re-open of a prior send's status
 *
 * Sending the master broadcast confirms via a typed-string confirmation
 * — Kevin types the recipient count to confirm. This is the same kind
 * of friction the sponsor-override flow uses (locked-spec 2.4 pattern).
 */

import { useEffect, useState } from 'react';
import type {
  BroadcastAudiencePreset,
  BroadcastAudiencePreview,
  BroadcastChannel,
  BroadcastEnqueueResponse,
  BroadcastRecord,
  BroadcastTemplate,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/lib/auth';
import { AudienceSelector } from '@/components/admin/broadcast/AudienceSelector';
import { BroadcastStatus } from '@/components/admin/broadcast/BroadcastStatus';
import { ChannelSelector } from '@/components/admin/broadcast/ChannelSelector';
import { Composer } from '@/components/admin/broadcast/Composer';
import { SendTestButton } from '@/components/admin/broadcast/SendTestButton';

const EMPTY_TEMPLATE: BroadcastTemplate = {
  smsText: '',
  emailSubject: '',
  emailText: '',
};

export function BroadcastPage() {
  const { me } = useAdminAuth();
  const [channel, setChannel] = useState<BroadcastChannel>('sms');
  const [preset, setPreset] = useState<BroadcastAudiencePreset>('all');
  const [customTmagIds, setCustomTmagIds] = useState<string[]>([]);
  const [template, setTemplate] = useState<BroadcastTemplate>(EMPTY_TEMPLATE);
  const [preview, setPreview] = useState<BroadcastAudiencePreview | null>(null);

  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [recent, setRecent] = useState<BroadcastRecord[] | null>(null);

  const [confirmText, setConfirmText] = useState('');
  const [enqueuing, setEnqueuing] = useState(false);
  const [enqueueErr, setEnqueueErr] = useState<string | null>(null);

  // First name from the admin's full name (best-effort split for preview seed).
  const [previewFirstName, previewLastName] = (() => {
    if (!me) return ['Kevin', ''];
    const parts = me.fullName.split(' ');
    return [parts[0] ?? me.fullName, parts.slice(1).join(' ')];
  })();
  const senderName = me?.fullName ?? 'Team Magnificent';

  // Reload the recent list when no active broadcast (initial + after submit).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/broadcast/list', { credentials: 'include' });
        const data = (await res.json()) as {
          ok: boolean;
          broadcasts?: BroadcastRecord[];
          error?: string;
        };
        if (data.ok) setRecent(data.broadcasts ?? []);
      } catch {
        // non-fatal
      }
    })();
  }, [activeBroadcastId]);

  // Reset template fields the channel doesn't use, so server validation
  // doesn't reject an old leftover value.
  useEffect(() => {
    setTemplate((prev) => ({
      smsText: channel === 'email' ? '' : prev.smsText,
      emailSubject: channel === 'sms' ? '' : prev.emailSubject,
      emailText: channel === 'sms' ? '' : prev.emailText,
    }));
  }, [channel]);

  const canEnqueue =
    !enqueuing &&
    preview !== null &&
    preview.totalEligible > 0 &&
    confirmText.trim() === String(preview.totalEligible);

  const handleEnqueue = async () => {
    setEnqueuing(true);
    setEnqueueErr(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audiencePreset: preset,
          customAudienceTmagIds: preset === 'custom' ? customTmagIds : undefined,
          channel,
          template: {
            smsText: template.smsText || null,
            emailSubject: template.emailSubject || null,
            emailText: template.emailText || null,
          },
        }),
      });
      const data = (await res.json()) as BroadcastEnqueueResponse & {
        error?: string;
        issues?: string[];
      };
      if (!data.ok) {
        const detail =
          data.issues && data.issues.length > 0 ? ` (${data.issues.join('; ')})` : '';
        setEnqueueErr((data.error ?? 'Enqueue failed.') + detail);
        return;
      }
      setActiveBroadcastId(data.broadcastId);
      setConfirmText('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      setEnqueueErr(`Network error: ${msg}`);
    } finally {
      setEnqueuing(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
          Admin · Section G · Broadcast
        </p>
        <h1 className="font-display text-[36px] leading-none mb-2">Broadcast</h1>
        <p className="text-cream-mute text-sm max-w-2xl">
          Send email and/or SMS to a selected audience of Brand Ambassadors. Never
          to prospects. Send a test to yourself before queueing a full audience.
          STOP-list members are excluded automatically.
        </p>
      </header>

      {activeBroadcastId ? (
        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveBroadcastId(null)}
          >
            ← Compose another
          </Button>
          <BroadcastStatus broadcastId={activeBroadcastId} />
        </div>
      ) : (
        <div className="space-y-6">
          <ChannelSelector value={channel} onChange={setChannel} />

          <AudienceSelector
            preset={preset}
            channel={channel}
            customTmagIds={customTmagIds}
            onPresetChange={setPreset}
            onCustomChange={setCustomTmagIds}
            onPreviewChange={setPreview}
          />

          <Composer
            channel={channel}
            template={template}
            onTemplateChange={setTemplate}
            previewFirstName={previewFirstName}
            previewLastName={previewLastName}
            previewSenderName={senderName}
          />

          <div className="border-t border-line pt-5 space-y-4">
            <div className="flex items-start gap-4">
              <SendTestButton channel={channel} template={template} />
              <p className="text-[12px] text-cream-mute font-mono leading-relaxed flex-1">
                Sends one real message to your BA contact. Verify it before you
                queue the master broadcast.
              </p>
            </div>

            <div className="border border-amber-500/30 rounded-md p-4 bg-amber-500/[0.04] space-y-3">
              <p className="font-mono tracking-label text-[10px] text-amber-400 uppercase">
                Queue master broadcast
              </p>
              <p className="text-sm text-cream-mute">
                {preview && preview.totalEligible > 0 ? (
                  <>
                    Type{' '}
                    <code className="font-mono text-gold bg-gold/[0.08] border border-gold/30 px-1.5 py-0.5 rounded">
                      {preview.totalEligible}
                    </code>{' '}
                    to confirm sending to {preview.totalEligible} eligible recipient
                    {preview.totalEligible === 1 ? '' : 's'} via {channel.toUpperCase()}.
                  </>
                ) : (
                  'No eligible recipients in the current audience.'
                )}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type recipient count"
                  className="bg-ink-2 border border-line text-cream rounded-md px-3 h-10 text-sm font-mono w-48 placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void handleEnqueue()}
                  disabled={!canEnqueue}
                >
                  {enqueuing ? 'Queuing…' : 'Queue broadcast'}
                </Button>
              </div>
              {enqueueErr && (
                <p className="font-mono text-[12px] text-red-400">{enqueueErr}</p>
              )}
            </div>
          </div>

          <RecentList
            recent={recent ?? []}
            onOpen={(id) => setActiveBroadcastId(id)}
          />
        </div>
      )}
    </div>
  );
}

function RecentList({
  recent,
  onOpen,
}: {
  recent: BroadcastRecord[];
  onOpen: (id: string) => void;
}) {
  if (recent.length === 0) return null;
  return (
    <div className="border-t border-line pt-5">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-3">
        Recent broadcasts
      </p>
      <div className="border border-line rounded-md">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-cream-faint font-mono tracking-label uppercase">
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Channel</th>
              <th className="text-left px-3 py-2">Audience</th>
              <th className="text-left px-3 py-2">Recipients</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.broadcastId} className="border-b border-line/40 last:border-b-0">
                <td className="px-3 py-1.5 text-cream-mute font-mono">
                  {new Date(b.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-cream">{b.channel}</td>
                <td className="px-3 py-1.5 text-cream">
                  {b.audiencePreset}
                  {b.isTestSend && (
                    <span className="ml-2 text-[10px] font-mono tracking-label uppercase text-amber-400">
                      test
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-cream">{b.recipientCount}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={
                      b.status === 'complete'
                        ? 'text-teal'
                        : b.status === 'failed'
                          ? 'text-red-400'
                          : b.status === 'sending'
                            ? 'text-gold'
                            : 'text-cream-mute'
                    }
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onOpen(b.broadcastId)}
                    className="text-cream-mute hover:text-gold underline-offset-2 hover:underline font-mono text-[11px] tracking-label uppercase"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

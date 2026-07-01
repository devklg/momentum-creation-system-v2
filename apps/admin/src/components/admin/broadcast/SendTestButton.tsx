/**
 * G.4 — Send-test-to-Kevin button.
 *
 * Sends ONE real message (via Telnyx and/or Resend) to Kevin's BA
 * contact. Server-side, this writes a btest_* broadcast record with
 * audiencePreset='custom' and one recipient row (the sending admin),
 * dispatched inline (no queue indirection).
 *
 * This is the LAST guardrail before a wide send. The brief is explicit:
 * verify the test arrives before queueing a full audience.
 */

import { useState } from 'react';
import type {
  McsBroadcastChannel,
  McsBroadcastSendTestResponse,
  McsBroadcastTemplate,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';

interface SendTestButtonProps {
  channel: McsBroadcastChannel;
  template: McsBroadcastTemplate;
  disabled?: boolean;
}

export function SendTestButton({ channel, template, disabled }: SendTestButtonProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<McsBroadcastSendTestResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = async () => {
    setSending(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/broadcast/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, template }),
      });
      const data = (await res.json()) as McsBroadcastSendTestResponse & {
        error?: string;
        issues?: string[];
      };
      if (!data.ok) {
        const detail =
          data.issues && data.issues.length > 0 ? ` (${data.issues.join('; ')})` : '';
        setErr((data.error ?? 'Send-test failed.') + detail);
        return;
      }
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      setErr(`Network error: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={() => void handleClick()}
        disabled={disabled || sending}
      >
        {sending ? 'Sending test…' : 'Send test to me'}
      </Button>
      {result && (
        <div className="border border-line rounded-md p-3 bg-ink-2/40 space-y-1">
          <p className="font-mono text-[11px] tracking-label uppercase text-gold">
            Test sent · status: {result.recipient.status}
          </p>
          {result.recipient.smsMessageId && (
            <p className="font-mono text-[11px] text-cream-mute">
              SMS id: {result.recipient.smsMessageId}
            </p>
          )}
          {result.recipient.emailMessageId && (
            <p className="font-mono text-[11px] text-cream-mute">
              Email id: {result.recipient.emailMessageId}
            </p>
          )}
          {result.recipient.failureReason && (
            <p className="font-mono text-[11px] text-amber-400">
              note: {result.recipient.failureReason}
            </p>
          )}
        </div>
      )}
      {err && (
        <p className="font-mono text-[12px] text-red-400 border border-red-500/40 rounded-md p-2">
          {err}
        </p>
      )}
    </div>
  );
}

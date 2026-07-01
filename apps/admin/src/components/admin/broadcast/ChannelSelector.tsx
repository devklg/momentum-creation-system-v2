/**
 * G.3 — Channel selector (sms / email / both).
 *
 * Pure presentational. Disabled state for individual options is exposed
 * so the composer page can surface the email-dormant note (the email
 * transport returns success today only when EMAIL_API_KEY is set AND
 * the from-domain is verified in Resend; this component renders the
 * note but does NOT prevent selection — Kevin may queue email anyway
 * and the worker will record 'failed: email_skipped_dormant').
 */

import type { McsBroadcastChannel } from '@momentum/shared';

interface ChannelSelectorProps {
  value: McsBroadcastChannel;
  onChange: (next: McsBroadcastChannel) => void;
}

const OPTIONS: Array<{ value: McsBroadcastChannel; label: string; hint: string }> = [
  { value: 'sms', label: 'SMS', hint: 'Telnyx · live' },
  { value: 'email', label: 'Email', hint: 'Resend · dormant until domain verified' },
  { value: 'both', label: 'Both', hint: 'SMS + Email per recipient' },
];

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-mono tracking-label text-[10px] text-gold uppercase">
        Channel
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'border rounded-md px-3 py-3 text-left transition-colors',
                active
                  ? 'border-gold bg-gold/[0.06]'
                  : 'border-line hover:border-cream-mute',
              ].join(' ')}
            >
              <p
                className={[
                  'font-display tracking-wide text-sm uppercase',
                  active ? 'text-gold' : 'text-cream',
                ].join(' ')}
              >
                {opt.label}
              </p>
              <p className="font-mono text-[10px] tracking-label uppercase text-cream-mute mt-1">
                {opt.hint}
              </p>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

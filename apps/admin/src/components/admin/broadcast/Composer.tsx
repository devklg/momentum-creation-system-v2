/**
 * G.1 — Composer with per-recipient interpolation + preview.
 *
 * Pure controlled form. The template fields surface the interpolation
 * tokens supported by the server (the client never renders rendered
 * text for a third-party recipient — only the template lives here).
 *
 * Preview pane shows the SMS / email body with `{{firstName}}` etc.
 * substituted with Kevin's own first name as the preview seed. This is
 * NOT the same as a send-test (which actually delivers via Telnyx /
 * Resend); it's an inline render so Kevin can sanity-check before he
 * hits Send Test.
 */

import type { McsBroadcastChannel, McsBroadcastTemplate } from '@momentum/shared';
import { MCS_BROADCAST_INTERPOLATION_TOKENS, MCS_BROADCAST_LIMITS } from '@momentum/shared';

interface ComposerProps {
  channel: McsBroadcastChannel;
  template: McsBroadcastTemplate;
  onTemplateChange: (next: McsBroadcastTemplate) => void;
  /** Seed for the live preview pane. */
  previewFirstName: string;
  previewLastName: string;
  previewSenderName: string;
}

export function Composer({
  channel,
  template,
  onTemplateChange,
  previewFirstName,
  previewLastName,
  previewSenderName,
}: ComposerProps) {
  const wantsSms = channel === 'sms' || channel === 'both';
  const wantsEmail = channel === 'email' || channel === 'both';

  return (
    <div className="space-y-4">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase">Composer</p>

      <div className="border border-line rounded-md p-3 bg-ink-2/40">
        <p className="font-mono text-[10px] tracking-label uppercase text-cream-faint mb-1.5">
          Interpolation tokens (server-rendered per recipient)
        </p>
        <div className="flex flex-wrap gap-2">
          {MCS_BROADCAST_INTERPOLATION_TOKENS.map((tok) => (
            <code
              key={tok}
              className="text-[12px] font-mono text-gold bg-gold/[0.08] border border-gold/30 px-2 py-0.5 rounded"
            >
              {tok}
            </code>
          ))}
        </div>
      </div>

      {wantsSms && (
        <div className="space-y-1.5">
          <label
            htmlFor="bc-sms"
            className="font-mono tracking-label text-[10px] text-gold uppercase"
          >
            SMS text · max {MCS_BROADCAST_LIMITS.smsMaxChars}
          </label>
          <textarea
            id="bc-sms"
            value={template.smsText ?? ''}
            onChange={(e) =>
              onTemplateChange({ ...template, smsText: e.target.value || null })
            }
            rows={4}
            maxLength={MCS_BROADCAST_LIMITS.smsMaxChars}
            placeholder="Hey {{firstName}} — quick note from {{senderName}}. …"
            className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-2 text-sm font-body placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors"
          />
          <p className="font-mono text-[10px] text-cream-faint">
            {(template.smsText ?? '').length} / {MCS_BROADCAST_LIMITS.smsMaxChars}
          </p>
        </div>
      )}

      {wantsEmail && (
        <>
          <div className="space-y-1.5">
            <label
              htmlFor="bc-subject"
              className="font-mono tracking-label text-[10px] text-gold uppercase"
            >
              Email subject · max {MCS_BROADCAST_LIMITS.emailSubjectMaxChars}
            </label>
            <input
              id="bc-subject"
              type="text"
              value={template.emailSubject ?? ''}
              onChange={(e) =>
                onTemplateChange({ ...template, emailSubject: e.target.value || null })
              }
              maxLength={MCS_BROADCAST_LIMITS.emailSubjectMaxChars}
              placeholder="Quick note, {{firstName}}"
              className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 h-11 text-sm font-body placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="bc-email"
              className="font-mono tracking-label text-[10px] text-gold uppercase"
            >
              Email body · plain text · max {MCS_BROADCAST_LIMITS.emailTextMaxChars}
            </label>
            <textarea
              id="bc-email"
              value={template.emailText ?? ''}
              onChange={(e) =>
                onTemplateChange({ ...template, emailText: e.target.value || null })
              }
              rows={10}
              maxLength={MCS_BROADCAST_LIMITS.emailTextMaxChars}
              placeholder={'Hi {{firstName}},\n\n…\n\n— {{senderName}}'}
              className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-2 text-sm font-body placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors"
            />
            <p className="font-mono text-[10px] text-cream-faint">
              {(template.emailText ?? '').length} / {MCS_BROADCAST_LIMITS.emailTextMaxChars}
            </p>
          </div>
        </>
      )}

      <Preview
        channel={channel}
        template={template}
        firstName={previewFirstName}
        lastName={previewLastName}
        senderName={previewSenderName}
      />
    </div>
  );
}

/** Client-side interpolation preview (NOT a send — purely visual). */
function Preview({
  channel,
  template,
  firstName,
  lastName,
  senderName,
}: {
  channel: McsBroadcastChannel;
  template: McsBroadcastTemplate;
  firstName: string;
  lastName: string;
  senderName: string;
}) {
  const wantsSms = channel === 'sms' || channel === 'both';
  const wantsEmail = channel === 'email' || channel === 'both';
  const fullName = `${firstName} ${lastName}`.trim();

  const render = (s: string | null): string => {
    if (!s) return '';
    return s
      .replaceAll('{{firstName}}', firstName)
      .replaceAll('{{lastName}}', lastName)
      .replaceAll('{{fullName}}', fullName)
      .replaceAll('{{senderName}}', senderName)
      .replace(/\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g, '');
  };

  return (
    <div className="border border-line rounded-md p-4 bg-ink-2/40 space-y-3">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase">
        Preview · seeded with {firstName || '<empty>'} / {senderName || '<empty>'}
      </p>
      {wantsSms && (
        <div>
          <p className="font-mono text-[10px] tracking-label uppercase text-cream-faint mb-1">
            SMS
          </p>
          <pre className="font-body text-sm text-cream whitespace-pre-wrap leading-relaxed">
            {render(template.smsText)}
          </pre>
        </div>
      )}
      {wantsEmail && (
        <div>
          <p className="font-mono text-[10px] tracking-label uppercase text-cream-faint mb-1">
            Email
          </p>
          <p className="font-display text-base text-cream mb-1.5">
            {render(template.emailSubject)}
          </p>
          <pre className="font-body text-sm text-cream whitespace-pre-wrap leading-relaxed border-t border-line pt-2">
            {render(template.emailText)}
          </pre>
        </div>
      )}
    </div>
  );
}

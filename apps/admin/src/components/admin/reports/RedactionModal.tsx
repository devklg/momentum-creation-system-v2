/**
 * RedactionModal — Kevin's per-export PII redaction choice (Chat #144).
 *
 * Locked decision (Kevin, Chat #144): a modal pops on every export click,
 * never persisted, never silent. Kevin picks one of:
 *
 *   • Export Redacted (DEFAULT-FOCUSED) — first names/initials masked,
 *     phone shows only last 4, email shows only first char + domain.
 *   • Export Raw — verbatim. Use only when sending to an audit or legal
 *     review where the unmasked data is required.
 *   • Cancel — closes without exporting.
 *
 * The choice is sent to the server as `?redact=true|false`. Either way
 * the export is audited with the choice recorded (`admin.report_export`,
 * `after.redact`).
 *
 * UX: simple overlay, focus-trapped on the default action so a fast
 * Enter-press exports redacted (the safe default). Escape cancels.
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export type RedactionChoice = 'redacted' | 'raw';

export interface RedactionModalProps {
  open: boolean;
  reportLabel: string;
  onChoose: (choice: RedactionChoice) => void;
  onCancel: () => void;
}

export function RedactionModal({
  open,
  reportLabel,
  onChoose,
  onCancel,
}: RedactionModalProps) {
  const redactBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Default-focus the safe choice.
    redactBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redaction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md mx-4 bg-ink border border-line rounded-md shadow-xl">
        <div className="px-6 pt-6 pb-2">
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
            Export · PII choice
          </p>
          <h2
            id="redaction-modal-title"
            className="font-display text-[22px] leading-tight mb-3"
          >
            {reportLabel}
          </h2>
          <p className="text-sm text-cream-mute leading-relaxed">
            <span className="text-cream">Redacted</span> masks first/last names,
            phone, and email. <span className="text-cream">Raw</span> exports
            the data verbatim. The choice is logged either way.
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-2">
          <Button
            ref={redactBtnRef}
            variant="primary"
            onClick={() => onChoose('redacted')}
            className="w-full"
          >
            Export Redacted
          </Button>
          <Button
            variant="outline"
            onClick={() => onChoose('raw')}
            className="w-full"
          >
            Export Raw
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

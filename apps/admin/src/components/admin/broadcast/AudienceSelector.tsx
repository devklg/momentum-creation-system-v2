/**
 * G.2 — Audience preset selector with live count.
 *
 * Fetches the audience preview from `/api/admin/broadcast/audience` on
 * every preset / channel change. The preview is server-resolved (STOP
 * exclusion + missing-address counts are all done server-side); this
 * component only renders the breakdown.
 *
 * 'custom' surfaces a textarea for comma- or newline-separated TM BA IDs.
 * The server validates the list against existing BAs and the STOP list.
 */

import { useEffect, useState } from 'react';
import type {
  BroadcastAudiencePreset,
  BroadcastAudiencePreview,
  BroadcastAudiencePreviewResponse,
  BroadcastChannel,
} from '@momentum/shared';

interface AudienceSelectorProps {
  preset: BroadcastAudiencePreset;
  channel: BroadcastChannel;
  customTmagIds: string[];
  onPresetChange: (next: BroadcastAudiencePreset) => void;
  onCustomChange: (next: string[]) => void;
  onPreviewChange: (preview: BroadcastAudiencePreview | null) => void;
}

const PRESETS: Array<{ value: BroadcastAudiencePreset; label: string; hint: string }> = [
  { value: 'all', label: 'All BAs', hint: 'Every Brand Ambassador on the team' },
  { value: 'first_72h', label: 'First 72h', hint: 'Signed up in the last 72 hours' },
  { value: 'leaders', label: 'Leaders', hint: 'Curated ∪ qualified leaders' },
  { value: 'at_risk', label: 'At risk', hint: 'Inactive >14d, signed up >7d ago' },
  { value: 'custom', label: 'Custom', hint: 'Specific TM BA IDs' },
];

export function AudienceSelector({
  preset,
  channel,
  customTmagIds,
  onPresetChange,
  onCustomChange,
  onPreviewChange,
}: AudienceSelectorProps) {
  const [preview, setPreview] = useState<BroadcastAudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [customText, setCustomText] = useState(customTmagIds.join(', '));

  // Refresh the preview when preset / channel / custom set changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        params.set('preset', preset);
        params.set('channel', channel);
        if (preset === 'custom' && customTmagIds.length > 0) {
          params.set('customTmagIds', customTmagIds.join(','));
        }
        const res = await fetch(`/api/admin/broadcast/audience?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as BroadcastAudiencePreviewResponse & {
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok) {
          setErr(data.error ?? 'Could not resolve audience.');
          setPreview(null);
          onPreviewChange(null);
          return;
        }
        setPreview(data.preview);
        onPreviewChange(data.preview);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'unknown';
        setErr(`Network error: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, channel, customTmagIds, onPreviewChange]);

  const handleCustomBlur = () => {
    const ids = customText
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onCustomChange(ids);
  };

  return (
    <div className="space-y-3">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase">Audience</p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {PRESETS.map((opt) => {
          const active = preset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPresetChange(opt.value)}
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
              <p className="font-mono text-[10px] tracking-label text-cream-mute mt-1">
                {opt.hint}
              </p>
            </button>
          );
        })}
      </div>

      {preset === 'custom' && (
        <div className="space-y-2">
          <label
            htmlFor="bc-custom"
            className="font-mono tracking-label text-[10px] text-gold uppercase"
          >
            TM BA IDs (comma or whitespace separated)
          </label>
          <textarea
            id="bc-custom"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onBlur={handleCustomBlur}
            placeholder="TMAG-20260120-XYZ123, TMAG-20260121-ABC456"
            rows={3}
            className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-2 text-sm font-mono placeholder:text-cream/30 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      )}

      <div className="border border-line rounded-md p-4 bg-ink-2/40">
        {loading ? (
          <p className="font-mono text-[11px] tracking-label uppercase text-cream-faint">
            Resolving audience…
          </p>
        ) : err ? (
          <p className="font-mono text-[12px] text-red-400">{err}</p>
        ) : preview ? (
          <div className="space-y-2">
            <p className="font-display text-2xl text-gold tracking-wide">
              {preview.totalEligible}
              <span className="text-cream-mute text-sm font-mono ml-2 tracking-label uppercase">
                eligible recipients
              </span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px] font-mono tracking-label uppercase text-cream-mute">
              <Stat label="Candidates" value={preview.totalCandidates} />
              <Stat label="STOP excluded" value={preview.excludedBySTOP} tone={preview.excludedBySTOP > 0 ? 'warn' : undefined} />
              <Stat label="No email" value={preview.missingAddressEstimates.missingEmail} />
              <Stat label="No phone" value={preview.missingAddressEstimates.missingPhone} />
            </div>
            {preview.provenanceNote && (
              <p className="font-mono text-[11px] text-cream-faint border-t border-line pt-2 mt-2">
                {preview.provenanceNote}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div>
      <p className="text-cream-faint">{label}</p>
      <p className={tone === 'warn' ? 'text-amber-400 text-[15px] font-display' : 'text-cream text-[15px] font-display'}>
        {value}
      </p>
    </div>
  );
}

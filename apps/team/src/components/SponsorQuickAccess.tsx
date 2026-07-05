import { PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SponsorQuickAccessCard {
  fullName: string;
  firstName: string;
  lastInitial: string;
  phone: string | null;
  bestContactNote: string;
  whenToCall: string;
}

export interface SponsorFallbackFounder {
  fullName: string;
  firstName: string;
  phone: string | null;
}

export interface CockpitSponsorFallback {
  sponsorInactive: boolean;
  founders: SponsorFallbackFounder[];
}

interface SponsorQuickCardProps {
  sponsor: SponsorQuickAccessCard | null;
  fallback?: CockpitSponsorFallback | null;
  compact?: boolean;
}

export function SponsorQuickCard({
  sponsor,
  fallback = null,
  compact = false,
}: SponsorQuickCardProps) {
  if (!sponsor) {
    return (
      <div className="bg-cream/[0.02] border border-gold/20 rounded-md p-5">
        <p className="font-display text-[22px] text-gold leading-[1.1] mb-2">
          You're at the top.
        </p>
        <p className="text-cream-mute text-[13px] leading-[1.55]">
          As a founder of Team Magnificent, the line builds beneath you. Your
          team looks to you the way a downline looks to a sponsor.
        </p>
      </div>
    );
  }

  const showFallback = fallback?.sponsorInactive === true && fallback.founders.length > 0;

  return (
    <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold">
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[22px] text-cream leading-[1.1] mb-1">
            {sponsor.fullName}
          </p>
          <p className="text-cream-faint text-[12px] font-mono tracking-[0.06em] mb-3">
            YOUR SPONSOR
          </p>
        </div>
      </div>

      {sponsor.phone ? (
        <Button
          asChild
          className="mt-1 bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4 h-auto"
        >
          <a href={`tel:${sponsor.phone}`}>
            <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" />
            {sponsor.phone}
          </a>
        </Button>
      ) : (
        <p className="text-cream-faint text-[13px] leading-[1.5]">
          {sponsor.bestContactNote}
        </p>
      )}

      <div className={compact ? 'mt-4 space-y-3' : 'mt-5 space-y-4'}>
        <div>
          <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-1">
            Best contact
          </p>
          <p className="text-cream-mute text-[13px] leading-[1.55]">
            {sponsor.bestContactNote}
          </p>
        </div>
        <div>
          <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-1">
            When to call
          </p>
          <p className="text-cream text-[13px] leading-[1.55]">
            {sponsor.whenToCall}
          </p>
        </div>
      </div>

      {showFallback && (
        <div className="mt-4 pt-4 border-t border-gold/20">
          <p className="text-cream-mute text-[13px] leading-[1.55] mb-3">
            {sponsor.firstName} isn't active right now. Until they're back,
            reach out to a founder of Team Magnificent for support.
          </p>
          <p className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase mb-2">
            Founder support
          </p>
          <ul className="space-y-2">
            {fallback.founders.map((f) => (
              <li key={f.fullName} className="flex items-baseline justify-between gap-3">
                <span className="text-cream text-[14px]">{f.fullName}</span>
                {f.phone ? (
                  <a
                    href={`tel:${f.phone}`}
                    className="text-teal text-[13px] font-mono tracking-[0.04em] hover:underline"
                  >
                    {f.phone}
                  </a>
                ) : (
                  <span className="text-cream-faint text-[12px] font-mono">
                    contact in-app
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SponsorQuickModal({
  sponsor,
  open,
  loading,
  error,
  onClose,
}: {
  sponsor: SponsorQuickAccessCard | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-5 py-8 flex items-center justify-center">
      <div className="w-full max-w-[460px] bg-ink border border-gold/35 rounded-md p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-mono tracking-[0.18em] text-[10px] text-gold uppercase mb-2">
              Talk to my sponsor
            </p>
            <h2 className="font-display text-[30px] leading-none text-cream">
              Your Sponsor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] tracking-[0.12em] text-cream-faint hover:text-cream uppercase"
          >
            Close
          </button>
        </div>
        {loading && (
          <p className="font-mono text-[12px] tracking-[0.06em] text-cream-faint">
            Loading sponsor card...
          </p>
        )}
        {error && (
          <p className="font-mono text-[12px] tracking-[0.06em] text-red-400">
            {error}
          </p>
        )}
        {!loading && !error && <SponsorQuickCard sponsor={sponsor} compact />}
      </div>
    </div>
  );
}

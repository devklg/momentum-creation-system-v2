/**
 * /cockpit — stub destination after /welcome.
 * Locked Chat #94: ship a placeholder so the welcome flow has somewhere to land.
 * The real cockpit (TEAM Design Section H) is Phase 4 work.
 */

export function CockpitStubPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink text-cream">
      <div className="max-w-lg text-center">
        <p className="font-display tracking-eyebrow text-[13px] text-gold mb-4">
          TEAM MAGNIFICENT · COCKPIT
        </p>
        <h1 className="font-display text-[48px] leading-[1.05] text-cream mb-5">
          Cockpit coming soon.
        </h1>
        <p className="text-cream-mute text-[15px] leading-relaxed">
          Your commitment is recorded. Michael will call you shortly.
        </p>
        <p className="text-cream-faint text-[13px] mt-6 font-mono tracking-[0.04em]">
          BUILD IN PROGRESS · PHASE 4
        </p>
      </div>
    </div>
  );
}

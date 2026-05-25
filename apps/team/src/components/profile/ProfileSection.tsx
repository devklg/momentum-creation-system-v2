/**
 * ProfileSection — the card shell every wireframe 3.8 section uses.
 *
 * One eyebrow + title + body slot. Keeps the rhythm consistent across
 * Identity, Name, Email, Phone, Password, Photo, Timezone, NotifPrefs
 * without each section reimplementing the chrome.
 */

import type { ReactNode } from 'react';

export interface ProfileSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function ProfileSection({ eyebrow, title, description, children }: ProfileSectionProps) {
  return (
    <section className="rounded-lg border border-line bg-ink-2/40 p-5 md:p-6 space-y-4">
      <header>
        <p className="font-display tracking-eyebrow text-[11px] text-gold mb-1.5">{eyebrow}</p>
        <h2 className="font-display text-[22px] leading-tight text-cream">{title}</h2>
        {description && <p className="text-[13px] text-cream-mute mt-1.5">{description}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default ProfileSection;

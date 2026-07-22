/**
 * / — public Team Magnificent homepage (MNO 804).
 */

import { CompassRose } from '@/components/CompassRose';

export function ComHomepagePage() {
  return (
    <main className='min-h-screen bg-ink text-cream px-6 py-12'>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-10'>
        <header className='rounded-2xl border border-line bg-ink-2/75 p-8 shadow-glow'>
          <div className='flex flex-col items-center gap-5 text-center'>
            <CompassRose size={88} className='motion-glow opacity-95' />
            <div className='font-body text-sm tracking-wide text-cream-faint uppercase'>
              Team Magnificent
            </div>
            <h1 className='font-display text-3xl leading-tight sm:text-4xl lg:text-5xl max-w-3xl'>
              Building businesses together — so no one builds alone.
            </h1>
            <p className='max-w-2xl text-base text-cream-mute'>
              Team Magnificent is a community of independent brand ambassadors sharing
              health and wellness — physically and financially — with a step-by-step
              system for people exploring work-from-home opportunities.
            </p>
          </div>
        </header>

        <section className='rounded-2xl border border-line bg-ink-2/70 p-8'>
          <h2 className='font-display text-2xl'>How it works</h2>
          <ol className='mt-4 space-y-4 text-cream-mute'>
            <li>1. A friend shares a link — everyone here was invited by someone they know.</li>
            <li>
              2. Watch the presentation — a short video explains the product, start
              to finish.
            </li>
            <li>
              3. Talk it over — a real conversation with the person who invited you.
              No pressure, no scripts.
            </li>
            <li>
              4. Build with the team — training, tools, and a live system support every new
              member from day one.
            </li>
          </ol>
        </section>

        <section className='rounded-2xl border border-line bg-ink-2/70 p-8'>
          <h2 className='font-display text-2xl'>About</h2>
          <p className='mt-4 text-cream-mute'>
            We believe the best businesses are built person to person. Our team supports
            people who want to build with honest effort, real products, and a team that shows
            up. Building a business takes consistent effort.
          </p>
        </section>

        <section className='rounded-2xl border border-line bg-ink-2/70 p-8'>
          <h2 className='font-display text-2xl'>Contact</h2>
          <p className='mt-4 text-cream-mute'>Team Magnificent</p>
          <p className='text-cream-mute'>support@teammagnificent.com</p>
          <p className='text-cream-mute'>1770 Litchfield Dr, Banning, CA 92220</p>
        </section>

        <footer className='rounded-2xl border border-line bg-ink-2/70 p-6 text-sm text-cream-faint'>
          <p>© Team Magnificent · <a href='/privacy' className='underline hover:text-gold'>Privacy Policy</a> · <a href='/terms' className='underline hover:text-gold'>Terms of Service</a></p>
        </footer>
      </div>
    </main>
  );
}

/**
 * /terms — prospect-facing terms for teammagnificent.com.
 */

import { Link } from 'react-router-dom';

export function ComTermsPage() {
  return (
    <main className='min-h-screen bg-ink text-cream px-6 py-12'>
      <div className='mx-auto w-full max-w-4xl rounded-2xl border border-line bg-ink-2/75 p-8'>
        <h1 className='font-display text-3xl sm:text-4xl'>Terms of Service</h1>
        <p className='mt-3 text-cream-faint'>Effective date: July 22, 2026</p>

        <section className='mt-8 space-y-5 text-cream-mute'>
          <p>
            By using teammagnificent.com, you agree to use this website lawfully and
            consistently with the purpose of the platform.
          </p>

          <div>
            <h2 className='text-xl font-display text-cream'>1) Service purpose</h2>
            <p className='mt-2'>
              The site is a prospect-facing information and onboarding platform that provides
              invitation links, presentation access, and webinar follow-up workflow tools.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>2) Account and access</h2>
            <p className='mt-2'>
              Invitation links are intended for the person invited. If a link does not
              belong to you, contact the person who shared it.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>3) Communications and updates</h2>
            <p className='mt-2'>
              By continuing in the flow and sharing preferences, you allow Team Magnificent
              to send service-related communication by SMS or email tied to invitations,
              reminders, or webinar events.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>4) Prohibited use</h2>
            <p className='mt-2'>
              You may not misuse the platform, attempt unauthorized access, or use site
              content to violate law or platform policy. Automated scraping and abuse of
              the invitation path is prohibited.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>5) Availability</h2>
            <p className='mt-2'>
              The service is provided as is and as available. We may update features and
              flows to improve operations, including maintenance windows.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>6) Limitation of liability</h2>
            <p className='mt-2'>
              Team Magnificent is not responsible for business results, third-party claims,
              or external network issues that affect message delivery. Our responsibility
              is limited to operating this digital experience and its related communications
              features.
            </p>
          </div>

          <div>
            <h2 className='text-xl font-display text-cream'>7) Governing law</h2>
            <p className='mt-2'>
              These terms are governed by California law where not preempted by applicable
              state law. Disputes are handled in the appropriate courts in California.
            </p>
          </div>

          <p className='text-sm text-cream-faint'>
            For privacy practices, visit <Link to='/privacy' className='underline'>/privacy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * /privacy — prospect-facing privacy policy for teammagnificent.com.
 */

import { Link } from 'react-router-dom';

export function ComPrivacyPage() {
  return (
    <main className="min-h-screen bg-ink text-cream px-6 py-12">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-line bg-ink-2/75 p-8">
        <h1 className="font-display text-3xl sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-cream-faint">Effective date: July 22, 2026</p>

        <section className="mt-8 space-y-5 text-cream-mute">
          <p>
            This policy explains how Team Magnificent collects, uses, and protects
            information on teammagnificent.com.
          </p>

          <div>
            <h2 className="text-xl font-display text-cream">1) What we collect</h2>
            <p className="mt-2">
              We collect data you submit in forms, including your name, phone number,
              and email, and technical data needed to operate the service such as device and
              session details. We also track basic prospect activity needed for event and
              delivery workflows.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">2) How we use it</h2>
            <p className="mt-2">
              We use prospect data to run your invitation flow, maintain your current
              session, manage webinar communications, and support follow-up operations.
              We do not use prospect data for unrelated advertising audiences or outside sales lists.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">3) Cookies and storage</h2>
            <p className="mt-2">
              The site uses session and support cookies for secure operation and feature
              reliability. You can clear browser cookies at any time, though that may affect
              your current sign-in and session continuity.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">4) Communications</h2>
            <p className="mt-2">
              If you submit a phone number, you may receive text links or outbound messages
              related to your invitation and webinar workflow. You can always request a fresh
              link or reach out via support for help.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">5) Data retention</h2>
            <p className="mt-2">
              We keep records only as needed for system operations, compliance, and support.
              We do not retain more than necessary for the business workflow and internal auditing
              requirements.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">6) Your rights</h2>
            <p className="mt-2">
              You may request access, correction, or deletion of your data by contacting
              support at support@teammagnificent.com. We review requests and respond through
              Team Magnificent operations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display text-cream">7) Contact</h2>
            <p className="mt-2">
              Team Magnificent<br />
              1770 Litchfield Dr, Banning, CA 92220
            </p>
            <p className="mt-2">
              support@teammagnificent.com
            </p>
          </div>

          <p className="text-sm text-cream-faint">
            For Terms of Service, visit <Link to="/terms" className="underline">/terms</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

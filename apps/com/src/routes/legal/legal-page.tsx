import { Link } from 'react-router-dom';
import type { LegalDocument, LegalSection } from './legal-documents';

interface LegalPageProps {
  document: LegalDocument;
}

export function LegalPage({ document }: LegalPageProps) {
  return (
    <main className="tm-legal-page" aria-label={document.title}>
      <section className="tm-legal-page__surface">
        <header className="tm-legal-page__header">
          <p className="tm-legal-page__eyebrow">Team Magnificent</p>
          <h1>{document.title}</h1>
          <p className="tm-legal-page__meta">Effective date: {document.effectiveDate}</p>
        </header>

        <div className="tm-legal-page__content">
          {document.sections.map((section) => {
            switch (section.kind) {
              case 'content':
                return <LegalContentSection key={section.heading ?? section.paragraphs?.[0]} section={section} />;
              case 'address':
                return <LegalAddressSection key={section.heading} section={section} />;
            }
          })}
        </div>

        <footer className="tm-legal-page__footer">
          <Link to="/p/login" className="tm-legal-page__home-link">
            Prospect sign in
          </Link>
          <div className="tm-legal-page__help-links" aria-label="Legal pages">
            <Link to="/privacy">Privacy Policy</Link>
            <span aria-hidden="true">•</span>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}

function LegalContentSection({ section }: { section: Extract<LegalSection, { kind: 'content' }> }) {
  return (
    <section className="tm-legal-page__section">
      {section.heading ? <h2>{section.heading}</h2> : null}
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.items ? (
        <ul>
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LegalAddressSection({ section }: { section: Extract<LegalSection, { kind: 'address' }> }) {
  return (
    <section className="tm-legal-page__section">
      <h2>{section.heading}</h2>
      <address className="tm-legal-page__address">
        <div>
          {section.organization} · <a href={`mailto:${section.email}`}>{section.email}</a>
        </div>
        <div>{section.streetAddress}</div>
      </address>
    </section>
  );
}

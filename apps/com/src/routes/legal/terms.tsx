import { LegalPage } from './legal-page';
import { TERMS_DOCUMENT } from './legal-documents';

export function TermsPage() {
  return <LegalPage document={TERMS_DOCUMENT} />;
}

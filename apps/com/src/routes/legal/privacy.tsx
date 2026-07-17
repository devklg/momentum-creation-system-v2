import { LegalPage } from './legal-page';
import { PRIVACY_DOCUMENT } from './legal-documents';

export function PrivacyPage() {
  return <LegalPage document={PRIVACY_DOCUMENT} />;
}

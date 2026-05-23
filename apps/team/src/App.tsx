import { Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './routes/register';
import { WelcomePage } from './routes/welcome';
import { CockpitPage } from './routes/cockpit';
import { MichaelSchedulePage } from './routes/michael-schedule';
import { TenStepsPage } from './routes/training/10-steps';
import { QuestionnairePage } from './routes/onboarding/questionnaire';
import { SponsorWorkbookPage } from './routes/sponsor/interview-workbook';
import { InvitationsPage } from './routes/invitations';
import { VideoLibraryPage } from './routes/video-library';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/michael/schedule" element={<MichaelSchedulePage />} />
      <Route path="/cockpit" element={<CockpitPage />} />
      <Route path="/invitations" element={<InvitationsPage />} />
      <Route path="/video-library" element={<VideoLibraryPage />} />
      <Route path="/training/10-steps" element={<TenStepsPage />} />
      <Route path="/onboarding/questionnaire" element={<QuestionnairePage />} />
      <Route path="/sponsor/interview-workbook/:baId" element={<SponsorWorkbookPage />} />
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center text-cream-mute font-mono text-sm">
            404 · not found
          </div>
        }
      />
    </Routes>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './routes/register';
import { LoginPage } from './routes/login';
import { WelcomePage } from './routes/welcome';
import { CockpitPage } from './routes/cockpit';
import { SteveSuccessInterviewPage } from './routes/steve-success-interview';
import { TenStepsPage } from './routes/training/10-steps';
import { FastStartHubPage } from './routes/training/fast-start/index';
import { ModuleProductPage } from './routes/training/fast-start/product';
import { ModuleCompLayer1Page } from './routes/training/fast-start/comp-layer-1';
import { ModuleBinaryPage } from './routes/training/fast-start/binary';
import { ModuleProspectListPage } from './routes/training/fast-start/prospect-list';
import { ModuleTeamPage } from './routes/training/fast-start/team';
import { QuestionnairePage } from './routes/onboarding/questionnaire';
import { SponsorWorkbookPage } from './routes/sponsor/interview-workbook';
import { InvitationsPage } from './routes/invitations';
import { VideoLibraryPage } from './routes/video-library';
import { IvoryPage } from './routes/ivory';
import { IvoryMomentumPage } from './routes/ivory-momentum';
import { CrmPage } from './routes/crm';
import { VmCampaignsPage } from './routes/vm-campaigns';
import { ProfilePage } from './routes/profile';
import { LeadershipPage } from './routes/leadership';
import { PreviewPage } from './routes/preview';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/steve/discovery" element={<SteveSuccessInterviewPage />} />
      <Route path="/cockpit" element={<CockpitPage />} />
      <Route path="/invitations" element={<InvitationsPage />} />
      <Route path="/video-library" element={<VideoLibraryPage />} />
      <Route path="/ivory" element={<IvoryPage />} />
      <Route path="/ivory/momentum" element={<IvoryMomentumPage />} />
      <Route path="/crm" element={<CrmPage />} />
      <Route path="/vm-campaigns" element={<VmCampaignsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/leadership" element={<LeadershipPage />} />
      <Route path="/training/10-steps" element={<TenStepsPage />} />
      <Route path="/training/fast-start" element={<FastStartHubPage />} />
      <Route path="/training/fast-start/product" element={<ModuleProductPage />} />
      <Route path="/training/fast-start/comp-layer-1" element={<ModuleCompLayer1Page />} />
      <Route path="/training/fast-start/binary" element={<ModuleBinaryPage />} />
      <Route path="/training/fast-start/prospect-list" element={<ModuleProspectListPage />} />
      <Route path="/training/fast-start/team" element={<ModuleTeamPage />} />
      <Route path="/onboarding/questionnaire" element={<QuestionnairePage />} />
      <Route path="/sponsor/interview-workbook/:baId" element={<SponsorWorkbookPage />} />
      <Route path="/preview" element={<PreviewPage />} />
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

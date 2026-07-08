import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TeamNav } from './components/TeamNav';
import { RegisterPage } from './routes/register';
import { LoginPage } from './routes/login';
import { WelcomePage } from './routes/welcome';
import { CockpitPage } from './routes/cockpit';
import { RecruitingCycleDashboardPage } from './components/launch/RecruitingCycleDashboard';
import { SteveSuccessInterviewPage } from './routes/steve-success-interview';
import { TenStepsPage } from './routes/training/10-steps';
import { FastStartHubPage } from './routes/training/fast-start/index';
import { ModuleProductPage } from './routes/training/fast-start/product';
import { ModuleCompLayer1Page } from './routes/training/fast-start/comp-layer-1';
import { ModuleBinaryPage } from './routes/training/fast-start/binary';
import { ModuleProspectListPage } from './routes/training/fast-start/prospect-list';
import { ModuleTeamPage } from './routes/training/fast-start/team';
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
      <Route element={<TeamShell />}>
        <Route path="/cockpit" element={<CockpitPage />} />
        <Route path="/launch" element={<RecruitingCycleDashboardPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/video-library" element={<VideoLibraryPage />} />
        <Route path="/ivory" element={<IvoryPage />} />
        <Route path="/ivory/momentum" element={<IvoryMomentumPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/vm-campaigns" element={<VmDialerRoute />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leadership" element={<LeadershipPage />} />
        <Route path="/training/10-steps" element={<TenStepsPage />} />
        <Route path="/training/fast-start" element={<FastStartHubPage />} />
        <Route path="/training/fast-start/product" element={<ModuleProductPage />} />
        <Route path="/training/fast-start/comp-layer-1" element={<ModuleCompLayer1Page />} />
        <Route path="/training/fast-start/binary" element={<ModuleBinaryPage />} />
        <Route path="/training/fast-start/prospect-list" element={<ModuleProspectListPage />} />
        <Route path="/training/fast-start/team" element={<ModuleTeamPage />} />
        <Route path="/sponsor/interview-workbook/:tmagId" element={<SponsorWorkbookPage />} />
        <Route path="/preview" element={<PreviewPage />} />
      </Route>
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

/**
 * TeamShell — layout wrapper that mounts the shared TeamNav above every
 * authenticated .team surface. Login/register/welcome and the Steve discovery
 * interview stay chrome-free (welcome is a ceremony page; Steve is immersive).
 */
function TeamShell() {
  return (
    <>
      <TeamNav />
      <Outlet />
    </>
  );
}

function VmDialerRoute() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { ok?: boolean; me?: { entitlements?: string[] } };
        return data.ok === true && (data.me?.entitlements ?? []).includes('vm_dialer');
      })
      .then((next) => {
        if (!cancelled) setAllowed(next);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return <div className="min-h-screen bg-ink" />;
  }
  return allowed ? <VmCampaignsPage /> : <Navigate to="/cockpit" replace />;
}

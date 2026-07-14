import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { TeamNav } from './components/TeamNav';

// P2-129: every page is a route boundary. The app shell stays in the entry
// chunk while each surface loads only when navigation reaches it.
const RegisterPage = lazy(() => import('./routes/register').then((module) => ({ default: module.RegisterPage })));
const LoginPage = lazy(() => import('./routes/login').then((module) => ({ default: module.LoginPage })));
const WelcomePage = lazy(() => import('./routes/welcome').then((module) => ({ default: module.WelcomePage })));
const CockpitPage = lazy(() => import('./routes/cockpit').then((module) => ({ default: module.CockpitPage })));
const RecruitingCycleDashboardPage = lazy(() => import('./components/launch/RecruitingCycleDashboard').then((module) => ({ default: module.RecruitingCycleDashboardPage })));
const SteveSuccessInterviewPage = lazy(() => import('./routes/steve-success-interview').then((module) => ({ default: module.SteveSuccessInterviewPage })));
const TenStepsPage = lazy(() => import('./routes/training/10-steps').then((module) => ({ default: module.TenStepsPage })));
const FastStartHubPage = lazy(() => import('./routes/training/fast-start/index').then((module) => ({ default: module.FastStartHubPage })));
const ModuleProductPage = lazy(() => import('./routes/training/fast-start/product').then((module) => ({ default: module.ModuleProductPage })));
const ModuleCompLayer1Page = lazy(() => import('./routes/training/fast-start/comp-layer-1').then((module) => ({ default: module.ModuleCompLayer1Page })));
const ModuleBinaryPage = lazy(() => import('./routes/training/fast-start/binary').then((module) => ({ default: module.ModuleBinaryPage })));
const ModuleProspectListPage = lazy(() => import('./routes/training/fast-start/prospect-list').then((module) => ({ default: module.ModuleProspectListPage })));
const ModuleTeamPage = lazy(() => import('./routes/training/fast-start/team').then((module) => ({ default: module.ModuleTeamPage })));
const SponsorWorkbookPage = lazy(() => import('./routes/sponsor/interview-workbook').then((module) => ({ default: module.SponsorWorkbookPage })));
const InvitationsPage = lazy(() => import('./routes/invitations').then((module) => ({ default: module.InvitationsPage })));
const VideoLibraryPage = lazy(() => import('./routes/video-library').then((module) => ({ default: module.VideoLibraryPage })));
const IvoryPage = lazy(() => import('./routes/ivory').then((module) => ({ default: module.IvoryPage })));
const IvoryMomentumPage = lazy(() => import('./routes/ivory-momentum').then((module) => ({ default: module.IvoryMomentumPage })));
const CrmPage = lazy(() => import('./routes/crm').then((module) => ({ default: module.CrmPage })));
const VmCampaignsPage = lazy(() => import('./routes/vm-campaigns').then((module) => ({ default: module.VmCampaignsPage })));
const ProfilePage = lazy(() => import('./routes/profile').then((module) => ({ default: module.ProfilePage })));
const LeadershipPage = lazy(() => import('./routes/leadership').then((module) => ({ default: module.LeadershipPage })));
const PreviewPage = lazy(() => import('./routes/preview').then((module) => ({ default: module.PreviewPage })));
const ResourcesPage = lazy(() => import('./routes/resources').then((module) => ({ default: module.ResourcesPage })));
const ResourceDetailPage = lazy(() => import('./routes/resource-detail').then((module) => ({ default: module.ResourceDetailPage })));
const EventsPage = lazy(() => import('./routes/events').then((module) => ({ default: module.EventsPage })));

export function App() {
  return (
    <Suspense fallback={<FullPageRouteLoading />}>
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
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/resources/:resourceVersionId" element={<ResourceDetailPage />} />
          <Route path="/events" element={<EventsPage />} />
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
    </Suspense>
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
      <Suspense fallback={<TeamRouteLoading />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function FullPageRouteLoading() {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center" role="status">
      <p className="font-mono text-[11px] uppercase tracking-label text-cream-faint">Loading page…</p>
    </div>
  );
}

function TeamRouteLoading() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-ink flex items-center justify-center" role="status">
      <p className="font-mono text-[11px] uppercase tracking-label text-cream-faint">Loading page…</p>
    </main>
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

import { Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './routes/register';
import { WelcomePage } from './routes/welcome';
import { CockpitStubPage } from './routes/cockpit';
import { MichaelSchedulePage } from './routes/michael-schedule';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/michael/schedule" element={<MichaelSchedulePage />} />
      <Route path="/cockpit" element={<CockpitStubPage />} />
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

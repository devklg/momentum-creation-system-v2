import { Routes, Route, Navigate } from 'react-router-dom';
import { PTokenPage } from './routes/p-token';
import { PLoginPage } from './routes/p-login';
import { PLoginRedeemPage } from './routes/p-login-redeem';
import { RvmTokenPage } from './routes/rvm-token';

export function App() {
  return (
    <Routes>
      {/*
        Login routes mount BEFORE /p/:token so the more specific paths
        win the match. /p/login and /p/login/r/:linkToken would
        otherwise be swallowed as token="login" by the wildcard.
        Locked-spec 3.17 (Chat #131 — prospect re-entry).
      */}
      <Route path="/p/login" element={<PLoginPage />} />
      <Route path="/p/login/r/:linkToken" element={<PLoginRedeemPage />} />
      <Route path="/p/:token" element={<PTokenPage />} />
      <Route path="/rvm/:token" element={<RvmTokenPage />} />
      <Route path="*" element={<Navigate to="/p/invalid" replace />} />
    </Routes>
  );
}

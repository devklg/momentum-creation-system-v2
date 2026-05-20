import { Routes, Route, Navigate } from 'react-router-dom';
import { PTokenPage } from './routes/p-token';

export function App() {
  return (
    <Routes>
      <Route path="/p/:token" element={<PTokenPage />} />
      <Route path="*" element={<Navigate to="/p/invalid" replace />} />
    </Routes>
  );
}

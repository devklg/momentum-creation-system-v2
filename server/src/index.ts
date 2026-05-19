/**
 * Momentum Creation System API.
 * Single Express server, shared by apps/com, apps/team, apps/admin.
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { welcomeRoutes } from './routes/welcome.js';
import { adminAccessCodesRoutes } from './routes/admin/access-codes.js';
import { michaelRoutes } from './routes/michael.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin/no-origin (curl, server-to-server)
      if (!origin) return cb(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/michael', michaelRoutes);
app.use('/api/admin/access-codes', adminAccessCodesRoutes);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(env.SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[momentum-server] listening on :${env.SERVER_PORT} (${env.NODE_ENV}) — admin BA IDs configured: ${env.ADMIN_BA_IDS.length}`,
  );
});

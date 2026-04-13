import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import matchRoutes from './routes/matches';
import standingRoutes from './routes/standings';
import roastRoutes from './routes/roasts';
import leagueRoutes from './routes/leagues';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes);
app.use('/teams',     teamRoutes);
app.use('/matches',   matchRoutes);
app.use('/standings', standingRoutes);
app.use('/roasts',    roastRoutes);
app.use('/leagues',   leagueRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GoatSoccer API running on http://localhost:${PORT}`);
  console.log('Android emulator → http://10.0.2.2:${PORT}');
});

export default app;

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { recalcStandings } from './standings';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtLeague(l: {
  id: string; name: string; season: string; coachId: string;
  teams: { teamId: string }[];
}) {
  return {
    _id: l.id, name: l.name, season: l.season,
    coachId: l.coachId,
    teamIds: l.teams.map(t => t.teamId),
  };
}

const leagueInclude = { teams: { select: { teamId: true } } } as const;

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /leagues
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const leagues = await prisma.league.findMany({
    include: leagueInclude,
    orderBy: { createdAt: 'desc' },
  });
  const data = leagues.map(fmtLeague);
  res.json({ success: true, data, count: data.length, message: '' });
});

// POST /leagues
router.post('/', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { name, season } = req.body as { name: string; season: string };
  if (!name || !season) {
    res.status(400).json({ success: false, message: 'name and season are required' });
    return;
  }
  const league = await prisma.league.create({
    data: { name, season, coachId: req.user!.userId },
    include: leagueInclude,
  });
  res.status(201).json({ success: true, data: fmtLeague(league), message: '' });
});

// DELETE /leagues/:id
router.delete('/:id', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  await prisma.league.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: null, message: 'League deleted' });
});

// POST /leagues/:id/teams  — add a team to a league
router.post('/:id/teams', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { teamId } = req.body as { teamId: string };
  if (!teamId) {
    res.status(400).json({ success: false, message: 'teamId is required' });
    return;
  }
  await prisma.leagueTeam.upsert({
    where: { leagueId_teamId: { leagueId: req.params.id, teamId } },
    update: {},
    create: { leagueId: req.params.id, teamId },
  });
  await recalcStandings(req.params.id);
  const league = await prisma.league.findUnique({
    where: { id: req.params.id },
    include: leagueInclude,
  });
  res.json({ success: true, data: league ? fmtLeague(league) : null, message: '' });
});

// DELETE /leagues/:id/teams/:teamId  — remove a team from a league
router.delete('/:id/teams/:teamId', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { teamId } = req.params;
  await prisma.leagueTeam.delete({
    where: { leagueId_teamId: { leagueId: req.params.id, teamId } },
  });
  // Remove stale standing row for this team in this league
  await prisma.standing.deleteMany({
    where: { leagueId: req.params.id, teamId },
  });
  await recalcStandings(req.params.id);
  const league = await prisma.league.findUnique({
    where: { id: req.params.id },
    include: leagueInclude,
  });
  res.json({ success: true, data: league ? fmtLeague(league) : null, message: '' });
});

export default router;

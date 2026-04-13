import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { recalcStandings } from './standings';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

const teamSelect = {
  id: true, name: true, city: true, logo: true, coach: true,
  _count: { select: { players: true } },
} as const;

function fmtTeam(t: {
  id: string; name: string; city: string; logo: string; coach: string;
  _count: { players: number };
}) {
  return {
    _id: t.id, name: t.name, city: t.city, logo: t.logo,
    coach: t.coach, playerCount: t._count.players,
    wins: 0, losses: 0, draws: 0, points: 0,
  };
}

function fmtMatch(m: {
  id: string;
  homeTeam: Parameters<typeof fmtTeam>[0];
  awayTeam: Parameters<typeof fmtTeam>[0];
  homeScore: number; awayScore: number;
  date: string; time: string; location: string;
  status: string; leagueId: string;
  goalScorers: { id: string; playerId: string; playerName: string; teamId: string }[];
}) {
  return {
    _id: m.id,
    homeTeam: fmtTeam(m.homeTeam),
    awayTeam: fmtTeam(m.awayTeam),
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    date: m.date,
    time: m.time,
    location: m.location,
    status: m.status,
    leagueId: m.leagueId,
    goalScorers: m.goalScorers.map(g => ({
      playerId: g.playerId, playerName: g.playerName, teamId: g.teamId,
    })),
  };
}

const matchInclude = {
  homeTeam: { select: teamSelect },
  awayTeam: { select: teamSelect },
  goalScorers: true,
} as const;

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /matches
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      include: matchInclude,
      orderBy: { date: 'desc' },
    });
    const data = matches.map(fmtMatch);
    res.json({ success: true, data, count: data.length, message: '' });
  } catch (err) {
    console.error('GET /matches error:', err);
    res.status(500).json({ success: false, data: [], message: String(err) });
  }
});

// GET /matches/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: matchInclude,
  });
  if (!match) { res.status(404).json({ success: false, message: 'Match not found' }); return; }
  res.json({ success: true, data: fmtMatch(match), message: '' });
});

// POST /matches
router.post('/', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { homeTeamId, awayTeamId, date, time, location, leagueId } = req.body as {
    homeTeamId: string; awayTeamId: string; date: string;
    time: string; location: string; leagueId?: string;
  };
  if (!homeTeamId || !awayTeamId || !date) {
    res.status(400).json({ success: false, message: 'homeTeamId, awayTeamId and date are required' });
    return;
  }
  const match = await prisma.match.create({
    data: { homeTeamId, awayTeamId, date, time: time ?? '', location: location ?? '', leagueId: leagueId ?? '' },
    include: matchInclude,
  });
  res.status(201).json({ success: true, data: fmtMatch(match), message: '' });
});

// PUT /matches/:id/score
router.put('/:id/score', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { homeScore, awayScore, status, scorers } = req.body as {
    homeScore: number; awayScore: number; status: string;
    scorers?: { playerId: string; playerName: string; teamId: string }[];
  };

  // Replace all goal events for this match
  await prisma.goalEvent.deleteMany({ where: { matchId: req.params.id } });

  const match = await prisma.match.update({
    where: { id: req.params.id },
    data: {
      homeScore,
      awayScore,
      status,
      goalScorers: scorers?.length
        ? { create: scorers.map(s => ({ playerId: s.playerId, playerName: s.playerName, teamId: s.teamId })) }
        : undefined,
    },
    include: matchInclude,
  });

  // Update player goal counts from scorer list
  if (scorers?.length) {
    const goalsByPlayer = scorers.reduce<Record<string, number>>((acc, s) => {
      acc[s.playerId] = (acc[s.playerId] ?? 0) + 1;
      return acc;
    }, {});
    await Promise.all(
      Object.entries(goalsByPlayer).map(([playerId, goals]) =>
        prisma.player.update({ where: { id: playerId }, data: { goals } })
      )
    );
  }

  // Recalculate standings on every score update (covers finish, re-open, correction)
  await Promise.all([
    recalcStandings(match.leagueId),   // league-specific standings
    recalcStandings(''),               // global standings (leagueId = '')
  ]);

  res.json({ success: true, data: fmtMatch(match), message: '' });
});

// DELETE /matches/:id
router.delete('/:id', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id }, select: { leagueId: true } });
  await prisma.match.delete({ where: { id: req.params.id } });
  if (match) {
    await Promise.all([
      recalcStandings(match.leagueId),
      recalcStandings(''),
    ]);
  }
  res.json({ success: true, data: null, message: 'Match deleted' });
});

export default router;

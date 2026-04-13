import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── Standing computation ──────────────────────────────────────────────────────
// Called after every score update to keep the standings table accurate.

export async function recalcStandings(leagueId: string): Promise<void> {
  // Get all matches for this league (empty leagueId = global)
  const matches = await prisma.match.findMany({
    where: leagueId ? { leagueId } : {},
  });

  // Accumulate stats per team
  const stats: Record<string, {
    won: number; drawn: number; lost: number;
    goalsFor: number; goalsAgainst: number;
  }> = {};

  function ensure(id: string) {
    if (!stats[id]) stats[id] = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  }

  for (const m of matches) {
    ensure(m.homeTeamId);
    ensure(m.awayTeamId);
    const h = stats[m.homeTeamId];
    const a = stats[m.awayTeamId];
    h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore)      { h.won++;   a.lost++;  }
    else if (m.homeScore < m.awayScore) { h.lost++;  a.won++;   }
    else                                { h.drawn++; a.drawn++; }
  }

  // Rebuild standings from scratch — delete stale rows then insert sorted
  const entries = Object.entries(stats)
    .map(([teamId, s]) => ({
      teamId,
      played: s.won + s.drawn + s.lost,
      won: s.won, drawn: s.drawn, lost: s.lost,
      goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalsFor - s.goalsAgainst,
      points: s.won * 3 + s.drawn,
    }))
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor
    );

  await prisma.standing.deleteMany({ where: { leagueId } });
  if (entries.length > 0) {
    await prisma.standing.createMany({
      data: entries.map((e, idx) => ({ ...e, leagueId, rank: idx + 1 })),
    });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

function fmtStanding(s: {
  id: string; leagueId: string; played: number; won: number; drawn: number;
  lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number; rank: number;
  team: { id: string; name: string; city: string; logo: string; coach: string;
          _count: { players: number } };
}) {
  return {
    _id: s.id,
    leagueId: s.leagueId,
    team: {
      _id: s.team.id, name: s.team.name, city: s.team.city,
      logo: s.team.logo, coach: s.team.coach,
      playerCount: s.team._count.players,
      wins: s.won, losses: s.lost, draws: s.drawn, points: s.points,
    },
    played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
    goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
    goalDifference: s.goalDifference, points: s.points, rank: s.rank,
  };
}

const standingInclude = {
  team: { select: { id: true, name: true, city: true, logo: true, coach: true,
                    _count: { select: { players: true } } } },
} as const;

// GET /standings  — all teams across all matches
router.get('/', authenticate, async (_req: Request, res: Response) => {
  await recalcStandings('');
  const rows = await prisma.standing.findMany({
    where: { leagueId: '' },
    orderBy: [{ rank: 'asc' }, { points: 'desc' }, { goalDifference: 'desc' }],
    include: standingInclude,
  });
  const data = rows.map(fmtStanding);
  res.json({ success: true, data, count: data.length, message: '' });
});

// GET /standings/top-scorers?leagueId=  — aggregated goal counts from GoalEvents
router.get('/top-scorers', authenticate, async (req: Request, res: Response) => {
  const leagueId = (req.query.leagueId as string | undefined)?.trim() || undefined;

  // If filtering by league, first find the match IDs that belong to that league
  let matchIdFilter: { matchId: { in: string[] } } | undefined;
  if (leagueId) {
    const matches = await prisma.match.findMany({
      where: { leagueId },
      select: { id: true },
    });
    matchIdFilter = { matchId: { in: matches.map(m => m.id) } };
  }

  const grouped = await prisma.goalEvent.groupBy({
    by: ['playerId', 'playerName', 'teamId'],
    _count: { playerId: true },
    orderBy: { _count: { playerId: 'desc' } },
    take: 20,
    where: matchIdFilter,
  });

  const teamIds = [...new Set(grouped.map(e => e.teamId))];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  });
  const teamMap: Record<string, string> = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const data = grouped.map(e => ({
    _id: e.playerId,
    name: e.playerName,
    teamId: e.teamId,
    teamName: teamMap[e.teamId] ?? '',
    position: '',
    number: 0,
    goals: e._count.playerId,
    assists: 0,
    isCaptain: false,
    yellowCards: 0,
    redCards: 0,
  }));
  res.json({ success: true, data, count: data.length, message: '' });
});

// GET /standings/:leagueId  — filtered by league
router.get('/:leagueId', authenticate, async (req: Request, res: Response) => {
  const { leagueId } = req.params;
  await recalcStandings(leagueId);
  const rows = await prisma.standing.findMany({
    where: { leagueId },
    orderBy: [{ rank: 'asc' }, { points: 'desc' }, { goalDifference: 'desc' }],
    include: standingInclude,
  });
  const data = rows.map(fmtStanding);
  res.json({ success: true, data, count: data.length, message: '' });
});

export default router;

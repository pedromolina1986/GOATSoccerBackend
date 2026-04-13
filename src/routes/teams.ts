import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { sendInviteEmail } from '../lib/mailer';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function formatTeam(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { _count: { select: { players: true } } },
  });
  if (!team) return null;
  return {
    _id: team.id,
    name: team.name,
    city: team.city,
    logo: team.logo,
    coach: team.coach,
    playerCount: team._count.players,
    wins: 0, losses: 0, draws: 0, points: 0, // computed from standings if needed
  };
}

async function allTeams() {
  const [teams, leagues] = await Promise.all([
    prisma.team.findMany({
      include: {
        _count: { select: { players: true } },
        standings: true,
        leagueTeams: { select: { leagueId: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.league.findMany({ select: { id: true, name: true, season: true } }),
  ]);

  const leagueMap = Object.fromEntries(leagues.map(l => [l.id, l]));

  return teams.map(t => {
    const leagueStats = t.standings.filter(s => s.leagueId !== '').map(s => ({
      leagueId:   s.leagueId,
      leagueName: leagueMap[s.leagueId]?.name   ?? 'Other',
      season:     leagueMap[s.leagueId]?.season ?? '',
      rank: s.rank,
      played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
      goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, points: s.points,
    }));

    const totals = leagueStats.reduce(
      (acc, s) => ({
        played:       acc.played       + s.played,
        won:          acc.won          + s.won,
        drawn:        acc.drawn        + s.drawn,
        lost:         acc.lost         + s.lost,
        goalsFor:     acc.goalsFor     + s.goalsFor,
        goalsAgainst: acc.goalsAgainst + s.goalsAgainst,
        points:       acc.points       + s.points,
      }),
      { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
    );

    return {
      _id: t.id, name: t.name, city: t.city, logo: t.logo, coach: t.coach,
      playerCount: t._count.players,
      wins:    totals.won,
      losses:  totals.lost,
      draws:   totals.drawn,
      points:  totals.points,
      leagueStats,
    };
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────────

// GET /teams
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const data = await allTeams();
  res.json({ success: true, data, count: data.length, message: '' });
});

// GET /teams/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const data = await formatTeam(req.params.id);
  if (!data) { res.status(404).json({ success: false, message: 'Team not found' }); return; }
  res.json({ success: true, data, message: '' });
});

// POST /teams
router.post('/', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { name, city, coach } = req.body as { name: string; city: string; coach: string };
  if (!name || !city || !coach) {
    res.status(400).json({ success: false, message: 'name, city and coach are required' });
    return;
  }
  const team = await prisma.team.create({ data: { name, city, coach } });
  res.status(201).json({
    success: true,
    data: { _id: team.id, name: team.name, city: team.city, logo: team.logo,
            coach: team.coach, playerCount: 0, wins: 0, losses: 0, draws: 0, points: 0 },
    message: '',
  });
});

// PUT /teams/:id
router.put('/:id', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { name, city, coach } = req.body as { name: string; city: string; coach: string };
  const team = await prisma.team.update({
    where: { id: req.params.id },
    data: { name, city, coach },
    include: { _count: { select: { players: true } } },
  });
  res.json({
    success: true,
    data: { _id: team.id, name: team.name, city: team.city, logo: team.logo,
            coach: team.coach, playerCount: team._count.players,
            wins: 0, losses: 0, draws: 0, points: 0 },
    message: '',
  });
});

// DELETE /teams/:id
router.delete('/:id', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  await prisma.team.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: null, message: 'Team deleted' });
});

// ── Players ───────────────────────────────────────────────────────────────────

function fmtPlayer(p: {
  id: string; name: string; position: string; number: number;
  goals: number; assists: number; yellowCards: number; redCards: number;
  isCaptain: boolean; teamId: string;
}) {
  return {
    _id: p.id, name: p.name, position: p.position, number: p.number,
    goals: p.goals, assists: p.assists, yellowCards: p.yellowCards,
    redCards: p.redCards, isCaptain: p.isCaptain, teamId: p.teamId,
  };
}

// GET /teams/:teamId/players
router.get('/:teamId/players', authenticate, async (req: Request, res: Response) => {
  const players = await prisma.player.findMany({
    where: { teamId: req.params.teamId },
    orderBy: { number: 'asc' },
  });
  const data = players.map(fmtPlayer);
  res.json({ success: true, data, count: data.length, message: '' });
});

// POST /teams/:teamId/players
router.post('/:teamId/players', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { name, position, number } = req.body as { name: string; position: string; number: number };
  if (!name || !position) {
    res.status(400).json({ success: false, message: 'name and position are required' });
    return;
  }
  const player = await prisma.player.create({
    data: { name, position, number: number ?? 0, teamId: req.params.teamId },
  });
  res.status(201).json({ success: true, data: fmtPlayer(player), message: '' });
});

// PUT /teams/:teamId/players/:playerId
router.put('/:teamId/players/:playerId', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { name, position, number } = req.body as { name: string; position: string; number: number };
  const player = await prisma.player.update({
    where: { id: req.params.playerId },
    data: { name, position, number },
  });
  res.json({ success: true, data: fmtPlayer(player), message: '' });
});

// DELETE /teams/:teamId/players/:playerId
router.delete('/:teamId/players/:playerId', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const playerId = req.params.playerId;
  await prisma.goalEvent.deleteMany({ where: { playerId } });
  await prisma.player.delete({ where: { id: playerId } });
  res.json({ success: true, data: null, message: 'Player deleted' });
});

// ── Player invite by email ────────────────────────────────────────────────────

// GET /teams/:teamId/invite/lookup?email=...
// Returns the registered user (+ existing player record) if the email is found.
router.get('/:teamId/invite/lookup', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  if (!email) {
    res.status(400).json({ success: false, message: 'email query param is required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.json({ success: true, data: { found: false }, message: '' });
    return;
  }

  const player = await prisma.player.findFirst({ where: { teamId: req.params.teamId } });

  res.json({
    success: true,
    data: {
      found: true,
      user: { _id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId },
      player: player ? fmtPlayer(player) : null,
    },
    message: '',
  });
});

// POST /teams/:teamId/invite
// • If the email belongs to a registered user → attach them to the team.
// • If not registered → create a placeholder player record and send an invite email.
router.post('/:teamId/invite', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { email, name, position, number } = req.body as {
    email: string; name?: string; position?: string; number?: number;
  };
  if (!email) {
    res.status(400).json({ success: false, message: 'email is required' });
    return;
  }

  const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
  if (!team) { res.status(404).json({ success: false, message: 'Team not found' }); return; }

  const invitingUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const coachName = invitingUser?.name ?? team.coach;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existing) {
    // Link the registered user to this team
    await prisma.user.update({ where: { id: existing.id }, data: { teamId: req.params.teamId } });

    // Create a player record for them if one doesn't exist on this team
    let player = await prisma.player.findFirst({
      where: { teamId: req.params.teamId, name: existing.name },
    });
    if (!player) {
      player = await prisma.player.create({
        data: {
          name: existing.name,
          position: position ?? '',
          number: number ?? 0,
          teamId: req.params.teamId,
        },
      });
    }
    res.status(201).json({ success: true, data: fmtPlayer(player), message: 'Player attached to team.' });
    return;
  }

  // Not registered — create placeholder player and send invite email
  const playerName = name?.trim() || email.split('@')[0];
  const player = await prisma.player.create({
    data: {
      name: playerName,
      position: position ?? '',
      number: number ?? 0,
      teamId: req.params.teamId,
      inviteEmail: email.toLowerCase(),
    },
  });

  // Fire-and-forget — don't block the response on email delivery
  sendInviteEmail(email.toLowerCase(), team.name, coachName).catch(err =>
    console.error('[MAILER] Failed to send invite email:', err)
  );

  res.status(201).json({
    success: true,
    data: fmtPlayer(player),
    message: `Invite sent to ${email}`,
  });
});

// PUT /teams/:teamId/players/:playerId/captain  — set/unset captain
router.put('/:teamId/players/:playerId/captain', authenticate, requireRole('coach'), async (req: Request, res: Response) => {
  const { teamId, playerId } = req.params;
  // Unset all current captains in the team, then set the selected one (or unset if already captain)
  const current = await prisma.player.findUnique({ where: { id: playerId }, select: { isCaptain: true } });
  const newValue = !current?.isCaptain;
  await prisma.player.updateMany({ where: { teamId }, data: { isCaptain: false } });
  if (newValue) {
    await prisma.player.update({ where: { id: playerId }, data: { isCaptain: true } });
  }
  res.json({ success: true, data: null, message: newValue ? 'Captain set' : 'Captain removed' });
});

export default router;

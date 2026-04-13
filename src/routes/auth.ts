import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, signToken } from '../middleware/auth';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name: string; email: string; password: string; role?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ success: false, message: 'name, email and password are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.active) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Inactive account — reactivate with new credentials
    const hashed = await bcrypt.hash(password, 10);

    const pendingInvite = await prisma.player.findFirst({
      where: { inviteEmail: email.toLowerCase() },
    });

    const reactivated = await prisma.user.update({
      where: { email },
      data: {
        name,
        password: hashed,
        role: pendingInvite ? 'player' : (role ?? existing.role),
        teamId: pendingInvite?.teamId ?? existing.teamId,
        active: true,
      },
    });

    if (pendingInvite) {
      await prisma.player.update({
        where: { id: pendingInvite.id },
        data: { inviteEmail: '' },
      });
    }

    const token = signToken(reactivated.id, reactivated.role);
    res.status(200).json({
      token,
      user: {
        _id: reactivated.id,
        name: reactivated.name,
        email: reactivated.email,
        role: reactivated.role,
        teamId: reactivated.teamId,
        token,
      },
    });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  const pendingInvite = await prisma.player.findFirst({
    where: { inviteEmail: email.toLowerCase() },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: pendingInvite ? 'player' : (role ?? 'fan'),
      teamId: pendingInvite?.teamId ?? null,
    },
  });

  if (pendingInvite) {
    await prisma.player.update({
      where: { id: pendingInvite.id },
      data: { inviteEmail: '' },
    });
  }

  const token = signToken(user.id, user.role);
  res.status(201).json({
    token,
    user: { _id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId, token },
  });
});

// GET /auth/lookup-invite?email=...  (no auth — called from registration screen)
router.get('/lookup-invite', async (req: Request, res: Response) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  if (!email) { res.json({ success: true, data: { found: false } }); return; }

  const player = await prisma.player.findFirst({
    where: { inviteEmail: email },
    include: { team: { select: { name: true } } },
  });

  if (!player) { res.json({ success: true, data: { found: false } }); return; }

  res.json({
    success: true,
    data: { found: true, name: player.name, teamName: player.team.name },
    message: '',
  });
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  if (!user.active) {
    res.status(403).json({
      success: false,
      message: 'This account has been deactivated. Register again with this email to reactivate it.',
    });
    return;
  }

  const token = signToken(user.id, user.role);
  res.json({
    token,
    user: { _id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId, token },
  });
});

// GET /auth/me — returns the authenticated user's profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.active) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      createdAt: user.createdAt,
    },
  });
});

// DELETE /auth/me — deactivates the account (soft delete; preserves all history)
router.delete('/me', authenticate, async (req: Request, res: Response) => {
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { active: false },
  });
  res.json({ success: true, data: null, message: 'Account deactivated' });
});

export default router;

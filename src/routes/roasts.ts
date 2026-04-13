import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

function fmtRoast(r: {
  id: string; targetType: string; targetId: string;
  content: string; likes: number; createdAt: Date;
  author: { id: string; name: string; email: string; role: string };
}) {
  return {
    _id: r.id,
    author: { _id: r.author.id, name: r.author.name, email: r.author.email, role: r.author.role },
    targetType: r.targetType,
    targetId: r.targetId,
    content: r.content,
    likes: r.likes,
    createdAt: r.createdAt.toISOString().split('T')[0],
  };
}

const roastInclude = {
  author: { select: { id: true, name: true, email: true, role: true } },
} as const;

// GET /roasts
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const roasts = await prisma.roast.findMany({
    include: roastInclude,
    orderBy: { createdAt: 'desc' },
  });
  const data = roasts.map(fmtRoast);
  res.json({ success: true, data, count: data.length, message: '' });
});

// POST /roasts
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { targetType, targetId, content } = req.body as {
    targetType: string; targetId: string; content: string;
  };
  if (!content?.trim()) {
    res.status(400).json({ success: false, message: 'content is required' });
    return;
  }
  const roast = await prisma.roast.create({
    data: { authorId: req.user!.userId, targetType, targetId, content },
    include: roastInclude,
  });
  res.status(201).json({ success: true, data: fmtRoast(roast), message: '' });
});

// DELETE /roasts/:id  — author or coach can delete
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const roast = await prisma.roast.findUnique({ where: { id: req.params.id } });
  if (!roast) { res.status(404).json({ success: false, message: 'Roast not found' }); return; }

  const isOwner = roast.authorId === req.user!.userId;
  const isCoach = req.user!.role === 'coach';
  if (!isOwner && !isCoach) {
    res.status(403).json({ success: false, message: 'You can only delete your own posts' });
    return;
  }

  await prisma.roast.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: null, message: 'Roast deleted' });
});

export default router;

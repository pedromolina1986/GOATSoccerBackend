backend/ structure:


backend/
├── prisma/
│   └── schema.prisma        ← SQLite schema (all 8 models)
├── src/
│   ├── index.ts             ← Express entry, port 3000
│   ├── seed.ts              ← Populates DB with mock data
│   ├── lib/prisma.ts        ← Prisma singleton
│   ├── middleware/auth.ts   ← JWT verify + requireRole()
│   └── routes/
│       ├── auth.ts          ← POST /auth/login|register
│       ├── teams.ts         ← /teams + /teams/:id/players
│       ├── matches.ts       ← /matches + PUT /matches/:id/score
│       ├── standings.ts     ← /standings (auto-computed)
│       ├── leagues.ts       ← /leagues + team membership
│       └── roasts.ts        ← /roasts
├── .env
├── package.json
└── tsconfig.json

First-time setup:

cd backend
npm install
npm run db:migrate      # creates the SQLite file + runs migrations
npm run db:generate     # generates Prisma client
npm run db:seed         # loads mock data
npm run dev             # starts on http://localhost:3000

Run APP in Android Studio

Email	Password	Role
coach@goatsoccer.com	password123	coach
player@goatsoccer.com	password123	player
fan@goatsoccer.com	password123	fan



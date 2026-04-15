# GoatSoccerManager — Backend API

REST API server for the GoatSoccerManager mobile app, built with Node.js, Express, TypeScript, and SQLite via Prisma ORM.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (bundled with Node.js)

---

## Installation

```bash
cd backend
npm install
```

---

## Database Setup

Run these commands once before starting the server for the first time:

```bash
# Create the SQLite database file and apply the schema
npm run db:migrate

# Generate the Prisma client types
npm run db:generate

# Seed the database with mock data
npm run db:seed
```

The database file is created at `prisma/goatsoccer.db`.

---

## Running the Server

### Development (with hot reload)

```bash
npm run dev
```

The server starts at **http://localhost:3000**.

### Production

```bash
npm run build
npm start
```

---

## Environment Variables

The `.env` file is included in the project with default development values:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/goatsoccer.db` | SQLite file path |
| `JWT_SECRET` | `goatsoccer-secret-key-change-in-prod` | JWT signing secret |
| `PORT` | `3000` | Server port |
| `SMTP_*` | _(empty)_ | Optional Gmail SMTP — leave blank to print email output to console |

---

## Default Credentials (Seeded)

| Email | Password | Role |
|---|---|---|
| coach@goatsoccer.com | password123 | coach |
| player@goatsoccer.com | password123 | player |
| fan@goatsoccer.com | password123 | fan |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Login, returns JWT |
| `GET` | `/teams` | List all teams |
| `POST` | `/teams` | Create a team (coach) |
| `GET` | `/teams/:id` | Get team details |
| `PUT` | `/teams/:id` | Update team (coach) |
| `GET` | `/teams/:id/players` | List players on a team |
| `POST` | `/teams/:id/invite` | Invite a player to team |
| `GET` | `/matches` | List all matches |
| `POST` | `/matches` | Create a match (coach) |
| `PUT` | `/matches/:id/score` | Update score + recalculate standings |
| `GET` | `/matches/:id/goals` | List goal events for a match |
| `GET` | `/standings` | Get computed league standings |
| `GET` | `/leagues` | List all leagues |
| `POST` | `/leagues` | Create a league |
| `GET` | `/roasts` | List all roasts |
| `POST` | `/roasts` | Post a roast |

---

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma        # SQLite schema (User, Team, Player, Match, League, Standing, Roast)
├── src/
│   ├── index.ts             # Express app entry point, port 3000
│   ├── seed.ts              # Populates DB with mock data
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   └── mailer.ts        # Nodemailer config (email invites)
│   ├── middleware/
│   │   └── auth.ts          # JWT verification + role-based access
│   └── routes/
│       ├── auth.ts          # POST /auth/login, /auth/register
│       ├── teams.ts         # /teams routes
│       ├── matches.ts       # /matches routes
│       ├── standings.ts     # /standings
│       ├── leagues.ts       # /leagues routes
│       └── roasts.ts        # /roasts routes
├── .env
├── package.json
└── tsconfig.json
```

---

## Useful Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Populate database with mock data |
| `npm run db:studio` | Open Prisma Studio UI at http://localhost:5555 |

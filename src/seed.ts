/**
 * Seed script — populates the SQLite DB with the same data as MockDataProvider
 * Run: npm run db:seed
 */
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('password123', 10);

  const coach = await prisma.user.upsert({
    where: { email: 'coach@goatsoccer.com' },
    update: {},
    create: { name: 'Demo Coach', email: 'coach@goatsoccer.com', password: pw, role: 'coach' },
  });
  const player = await prisma.user.upsert({
    where: { email: 'player@goatsoccer.com' },
    update: {},
    create: { name: 'Demo Player', email: 'player@goatsoccer.com', password: pw, role: 'player' },
  });
  await prisma.user.upsert({
    where: { email: 'fan@goatsoccer.com' },
    update: {},
    create: { name: 'Demo Fan', email: 'fan@goatsoccer.com', password: pw, role: 'fan' },
  });
  console.log('Users created');

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teamsData = [
    { name: 'Calgary FC',       city: 'Calgary',    coach: 'Carlos Mendes' },
    { name: 'Edmonton United',  city: 'Edmonton',   coach: 'Sarah Johnson' },
    { name: 'Red Deer Wolves',  city: 'Red Deer',   coach: 'Mike Torres'   },
    { name: 'Lethbridge Lions', city: 'Lethbridge', coach: 'Ana Souza'     },
    { name: 'Banff Rangers',    city: 'Banff',      coach: 'John Park'     },
  ];
  const teams = await Promise.all(
    teamsData.map(d => prisma.team.create({ data: d }))
  );
  const [t1, t2, t3, t4, t5] = teams;
  console.log('Teams created');

  // Link demo player to t1
  await prisma.user.update({ where: { id: player.id }, data: { teamId: t1.id } });

  // ── Players ────────────────────────────────────────────────────────────────
  const playersData = [
    { name: 'Marco Silva',     position: 'Forward',    number: 9,  goals: 12, assists: 5, isCaptain: true,  teamId: t1.id },
    { name: 'Lucas Pereira',   position: 'Midfielder', number: 8,  goals: 6,  assists: 9, isCaptain: false, teamId: t1.id },
    { name: 'Diego Hernandez', position: 'Defender',   number: 4,  goals: 1,  assists: 2, isCaptain: false, teamId: t1.id },
    { name: 'Nico Müller',     position: 'Goalkeeper', number: 1,  goals: 0,  assists: 0, isCaptain: false, teamId: t1.id },
    { name: 'James Okafor',    position: 'Forward',    number: 11, goals: 8,  assists: 4, isCaptain: false, teamId: t1.id },
    { name: 'Alex Kim',        position: 'Forward',    number: 10, goals: 9,  assists: 7, isCaptain: true,  teamId: t2.id },
    { name: 'Ravi Patel',      position: 'Midfielder', number: 6,  goals: 3,  assists: 8, isCaptain: false, teamId: t2.id },
    { name: 'Ethan Brown',     position: 'Defender',   number: 5,  goals: 0,  assists: 3, isCaptain: false, teamId: t2.id },
    { name: 'Omar Diallo',     position: 'Forward',    number: 7,  goals: 7,  assists: 2, isCaptain: true,  teamId: t3.id },
    { name: 'Liam Chen',       position: 'Midfielder', number: 14, goals: 2,  assists: 5, isCaptain: false, teamId: t3.id },
    { name: 'Pablo García',    position: 'Forward',    number: 9,  goals: 5,  assists: 3, isCaptain: true,  teamId: t4.id },
    { name: 'Noah Williams',   position: 'Midfielder', number: 8,  goals: 2,  assists: 2, isCaptain: true,  teamId: t5.id },
  ];
  const players = await Promise.all(
    playersData.map(d => prisma.player.create({ data: d }))
  );
  const [p1,,,,p5, p6,,,,,p11] = players;
  console.log('Players created');

  // ── Matches ────────────────────────────────────────────────────────────────
  const m1 = await prisma.match.create({
    data: {
      homeTeamId: t1.id, awayTeamId: t2.id,
      homeScore: 3, awayScore: 1,
      date: '2026-03-15', time: '14:00', location: 'McMahon Stadium',
      status: 'finished',
      goalScorers: {
        create: [
          { playerId: p1.id, playerName: p1.name, teamId: t1.id },
          { playerId: p1.id, playerName: p1.name, teamId: t1.id },
          { playerId: p5.id, playerName: p5.name, teamId: t1.id },
          { playerId: p6.id, playerName: p6.name, teamId: t2.id },
        ],
      },
    },
  });
  const m2 = await prisma.match.create({
    data: {
      homeTeamId: t3.id, awayTeamId: t4.id,
      homeScore: 2, awayScore: 2,
      date: '2026-03-16', time: '16:00', location: 'Westerner Park',
      status: 'finished',
    },
  });
  await prisma.match.create({
    data: {
      homeTeamId: t2.id, awayTeamId: t5.id,
      homeScore: 4, awayScore: 0,
      date: '2026-03-22', time: '15:00', location: 'Commonwealth Stadium',
      status: 'finished',
      goalScorers: {
        create: [
          { playerId: p6.id, playerName: p6.name, teamId: t2.id },
          { playerId: p6.id, playerName: p6.name, teamId: t2.id },
          { playerId: p6.id, playerName: p6.name, teamId: t2.id },
          { playerId: p11.id, playerName: p11.name, teamId: t2.id }, // own goal scenario — just for seed variety
        ],
      },
    },
  });
  await prisma.match.create({
    data: {
      homeTeamId: t1.id, awayTeamId: t3.id,
      date: '2026-04-05', time: '13:00', location: 'McMahon Stadium',
      status: 'scheduled',
    },
  });
  await prisma.match.create({
    data: {
      homeTeamId: t4.id, awayTeamId: t5.id,
      date: '2026-04-06', time: '17:00', location: 'Spitz Stadium',
      status: 'scheduled',
    },
  });
  await prisma.match.create({
    data: {
      homeTeamId: t2.id, awayTeamId: t3.id,
      date: '2026-04-12', time: '14:00', location: 'Commonwealth Stadium',
      status: 'scheduled',
    },
  });
  console.log('Matches created');

  // ── Leagues ────────────────────────────────────────────────────────────────
  const l1 = await prisma.league.create({
    data: {
      name: 'Alberta Premier League', season: '2026', coachId: coach.id,
      teams: { create: [t1, t2, t3, t4, t5].map(t => ({ teamId: t.id })) },
    },
  });
  await prisma.league.create({
    data: {
      name: 'Spring Cup', season: '2026', coachId: coach.id,
      teams: { create: [t1, t3].map(t => ({ teamId: t.id })) },
    },
  });

  // Assign the finished matches to l1
  await prisma.match.updateMany({
    where: { id: { in: [m1.id, m2.id] } },
    data: { leagueId: l1.id },
  });
  console.log('Leagues created');

  // ── Roasts ────────────────────────────────────────────────────────────────
  await prisma.roast.createMany({
    data: [
      { authorId: coach.id, targetType: 'match', targetId: m1.id,
        content: "Calgary FC just can't stop scoring! Edmonton better bring their A-game next time", likes: 14 },
      { authorId: fan_id(coach), targetType: 'player', targetId: p1.id,
        content: 'Marco Silva is on FIRE this season. 12 goals already? Unreal!', likes: 22 },
    ],
  });
  console.log('Roasts created');

  console.log('\nSeed complete!');
  console.log('  coach@goatsoccer.com  / password123  (role: coach)');
  console.log('  player@goatsoccer.com / password123  (role: player)');
  console.log('  fan@goatsoccer.com    / password123  (role: fan)');
}

function fan_id(u: { id: string }) { return u.id; } // alias to satisfy TS

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

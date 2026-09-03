/**
 * Deterministic Daily Leaderboard generator for Inudoku.
 * Generates engaging, realistic daily competitor scores based on the current date seed.
 */

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  time: string;
  isUser?: boolean;
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDateSeed(dateStr?: string): number {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y * 10000 + m * 100 + day;
}

const SHIBA_NAMES = [
  'ポチ丸',
  'ShibaKing',
  '柴犬まろん',
  'コロ助',
  '小太郎',
  'きなこ餅',
  'わんわんマスター',
  'ハチ',
  'むぎ茶',
  '黒柴リュウ',
  '大豆パパ',
  'ShibaLover99',
  'あずき',
  'モカ',
  'ゆずぽん',
  '福丸',
  'チョコ',
  'サクラ',
  'レオ',
  'ソラ',
  'チャチャ',
  'タロウ',
  '琥珀',
  '茶々丸',
];

const AVATARS = ['🐕', '🐕‍🦺', '🤍', '🐶', '🐾', '🌾', '🦊', '🦴'];

export interface PodiumEntry {
  rank: number;
  name: string;
  avatar: string;
  avatarBg: string;
  points: number;
  cylinderColor: string;
}

export interface TournamentEntry {
  rank: number;
  name: string;
  avatar: string;
  avatarBg: string;
  points: number;
  isUser?: boolean;
}

export interface RankUpResult {
  prevRank: number;
  newRank: number;
  prevPoints: number;
  earnedPoints: number;
  newPoints: number;
  top3: PodiumEntry[];
  displayList: TournamentEntry[];
  userIndexBefore: number;
  userIndexAfter: number;
}

const RIVAL_PROFILES = [
  { name: 'RJEA3M', avatar: '🦁', bg: '#FED7AA' },
  { name: 'VBB7VC', avatar: '🐶', bg: '#BFDBFE' },
  { name: 'xenW', avatar: '🐊', bg: '#BBF7D0' },
  { name: 'B94N36', avatar: '🐊', bg: '#DCFCE7' },
  { name: 'Tomoko', avatar: '🐼', bg: '#E2E8F0' },
  { name: 'Pochiko', avatar: '🐕', bg: '#FEF08A' },
  { name: 'KuroMaru', avatar: '🐕‍🦺', bg: '#DDD6FE' },
  { name: 'ShibaStar', avatar: '⭐', bg: '#FDE68A' },
  { name: 'MochiDog', avatar: '🍡', bg: '#FCE7F3' },
  { name: 'Kinako77', avatar: '🌾', bg: '#FEF3C7' },
  { name: 'Wanko99', avatar: '🦴', bg: '#F3E8FF' },
  { name: 'ChocoLatte', avatar: '🍫', bg: '#FED7AA' },
  { name: 'LuckyShiba', avatar: '🍀', bg: '#D1FAE5' },
  { name: 'Hachi08', avatar: '🐾', bg: '#E0E7FF' },
  { name: 'SakuraPaw', avatar: '🌸', bg: '#FBCFE8' },
];

/**
 * Generates 50 tournament competitors seeded by date.
 */
export function getTournamentCompetitors(): { name: string; avatar: string; avatarBg: string; points: number }[] {
  const dateSeed = getDateSeed();
  const rng = mulberry32(dateSeed);

  const competitors: { name: string; avatar: string; avatarBg: string; points: number }[] = [];

  // Top 3 fixed baseline
  competitors.push({ name: 'RJEA3M', avatar: '🦁', avatarBg: '#FED7AA', points: 29 + Math.floor(rng() * 4) });
  competitors.push({ name: 'VBB7VC', avatar: '🐶', avatarBg: '#BFDBFE', points: 26 + Math.floor(rng() * 3) });
  competitors.push({ name: 'xenW', avatar: '🐊', avatarBg: '#BBF7D0', points: 24 + Math.floor(rng() * 3) });

  // Ranks 4 to 50 smoothly descending
  let curPts = 23;
  for (let i = 3; i < 50; i++) {
    const prof = RIVAL_PROFILES[i % RIVAL_PROFILES.length];
    let name = prof.name;
    if (i >= RIVAL_PROFILES.length) {
      name = `${prof.name}${Math.floor(rng() * 89 + 10)}`;
    }
    // Slowly taper down points to 1 or 2 at rank 50
    if (i % 2 === 0 && curPts > 1) {
      curPts = Math.max(1, curPts - Math.floor(rng() * 2));
    }
    competitors.push({
      name,
      avatar: prof.avatar,
      avatarBg: prof.bg,
      points: curPts,
    });
  }

  return competitors;
}

/**
 * Calculates rank and surrounding competitors for a rank-up animation.
 */
export function calculateRankUp(prevUserPoints: number, earnedPoints: number): RankUpResult {
  const newUserPoints = prevUserPoints + earnedPoints;
  const rawCompetitors = getTournamentCompetitors();

  // 1. Determine prev rank
  let prevRank = 1;
  for (const c of rawCompetitors) {
    if (c.points > prevUserPoints) prevRank++;
  }
  prevRank = Math.min(50, Math.max(1, prevRank));

  // 2. Determine new rank
  let newRank = 1;
  for (const c of rawCompetitors) {
    if (c.points > newUserPoints) newRank++;
  }
  newRank = Math.min(50, Math.max(1, newRank));

  // Top 3 Podium
  const top3: PodiumEntry[] = [
    {
      rank: 2,
      name: rawCompetitors[1].name,
      avatar: rawCompetitors[1].avatar,
      avatarBg: rawCompetitors[1].avatarBg,
      points: rawCompetitors[1].points,
      cylinderColor: 'var(--podium-silver)',
    },
    {
      rank: 1,
      name: rawCompetitors[0].name,
      avatar: rawCompetitors[0].avatar,
      avatarBg: rawCompetitors[0].avatarBg,
      points: rawCompetitors[0].points,
      cylinderColor: 'var(--podium-gold)',
    },
    {
      rank: 3,
      name: rawCompetitors[2].name,
      avatar: rawCompetitors[2].avatar,
      avatarBg: rawCompetitors[2].avatarBg,
      points: rawCompetitors[2].points,
      cylinderColor: 'var(--podium-bronze)',
    },
  ];

  // 3. Build a local window of 3 entries to show the rank-up animation cleanly
  // e.g. Rank 48, Rank 49, and User (Rank 50 -> 49)
  const displayList: TournamentEntry[] = [];

  // Pick adjacent rivals near newRank / prevRank
  const rivalAbove = rawCompetitors[Math.max(0, newRank - 2)] || { name: 'B94N36', avatar: '🐊', avatarBg: '#DCFCE7', points: 3 };
  const rivalBelow = rawCompetitors[Math.max(0, newRank - 1)] || { name: 'Tomoko', avatar: '🐼', avatarBg: '#E2E8F0', points: 2 };

  displayList.push({
    rank: Math.max(1, newRank - 1),
    name: rivalAbove.name,
    avatar: rivalAbove.avatar,
    avatarBg: rivalAbove.avatarBg,
    points: Math.max(newUserPoints, rivalAbove.points),
  });

  displayList.push({
    rank: newRank,
    name: rivalBelow.name,
    avatar: rivalBelow.avatar,
    avatarBg: rivalBelow.avatarBg,
    points: Math.min(newUserPoints, rivalBelow.points),
  });

  displayList.push({
    rank: prevRank,
    name: 'あなた (柴犬マスター)',
    avatar: '🐶',
    avatarBg: '#FED7AA',
    points: prevUserPoints,
    isUser: true,
  });

  return {
    prevRank,
    newRank,
    prevPoints: prevUserPoints,
    earnedPoints,
    newPoints: newUserPoints,
    top3,
    displayList,
    userIndexBefore: 2,
    userIndexAfter: 1,
  };
}

/**
 * Generate daily leaderboard for the given date (backward compatibility).
 */
export function getDailyLeaderboard(userScore: number = 0, userTimeSecs: number = 0): LeaderboardEntry[] {
  const dateSeed = getDateSeed();
  const rng = mulberry32(dateSeed);

  const competitors: { name: string; avatar: string; score: number; timeSecs: number }[] = [];
  const usedNames = new Set<string>();
  let topScore = 3200 + Math.floor(rng() * 600);

  for (let i = 0; i < 24; i++) {
    let name = SHIBA_NAMES[Math.floor(rng() * SHIBA_NAMES.length)];
    while (usedNames.has(name)) {
      name += Math.floor(rng() * 90 + 10);
    }
    usedNames.add(name);

    const avatar = AVATARS[Math.floor(rng() * AVATARS.length)];
    const score = Math.max(120, topScore - Math.floor(rng() * 80 + 40));
    topScore = score;
    const timeSecs = Math.floor(45 + rng() * 180);
    competitors.push({ name, avatar, score, timeSecs });
  }

  const allEntries: { name: string; avatar: string; score: number; timeSecs: number; isUser?: boolean }[] = [
    ...competitors,
  ];

  if (userScore > 0) {
    allEntries.push({
      name: 'あなた (柴犬マスター)',
      avatar: '🐶',
      score: userScore,
      timeSecs: userTimeSecs,
      isUser: true,
    });
  }

  allEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSecs - b.timeSecs;
  });

  return allEntries.map((e, index) => {
    const mins = Math.floor(e.timeSecs / 60);
    const secs = e.timeSecs % 60;
    return {
      rank: index + 1,
      name: e.name,
      avatar: e.avatar,
      score: e.score,
      time: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
      isUser: !!e.isUser,
    };
  });
}


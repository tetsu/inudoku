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
 * Generates or retrieves 50 tournament competitors seeded by date, with dynamic progression.
 */
export function getDailyTournamentCompetitors(): TournamentEntry[] {
  const dateSeed = getDateSeed();
  const todayKey = `inudoku_rivals_${dateSeed}`;
  const stored = localStorage.getItem(todayKey);

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse rivals from localStorage', e);
    }
  }

  // Generate initial baseline competitors
  const rng = mulberry32(dateSeed);
  const competitors: TournamentEntry[] = [];

  // Top 3 fixed baseline
  competitors.push({ rank: 1, name: 'RJEA3M', avatar: '🦁', avatarBg: '#FED7AA', points: 30 + Math.floor(rng() * 3) });
  competitors.push({ rank: 2, name: 'VBB7VC', avatar: '🐶', avatarBg: '#BFDBFE', points: 27 + Math.floor(rng() * 2) });
  competitors.push({ rank: 3, name: 'xenW', avatar: '🐊', avatarBg: '#BBF7D0', points: 25 + Math.floor(rng() * 2) });

  // Ranks 4 to 50 smoothly distributed from 24 pts down to 0 pts
  for (let i = 3; i < 50; i++) {
    const prof = RIVAL_PROFILES[i % RIVAL_PROFILES.length];
    let name = prof.name;
    if (i >= RIVAL_PROFILES.length) {
      name = `${prof.name}${Math.floor(rng() * 89 + 10)}`;
    }
    // Smooth power curve: Rank 4 is ~24pt, Rank 50 is 0pt
    const progress = (49 - i) / 46; // 1.0 at i=3, 0.0 at i=49
    const pts = Math.round(24 * Math.pow(progress, 1.25));

    competitors.push({
      rank: i + 1,
      name,
      avatar: prof.avatar,
      avatarBg: prof.bg,
      points: pts,
    });
  }


  localStorage.setItem(todayKey, JSON.stringify(competitors));
  return competitors;
}

/**
 * Simulates rivals earning points realistically over time.
 * If user is clearing quickly, rivals will not overtake unfairly, allowing 1st place to be kept.
 */
export function simulateRivalPoints(): void {
  const dateSeed = getDateSeed();
  const todayKey = `inudoku_rivals_${dateSeed}`;
  const lastSimKey = `inudoku_rivals_last_sim_${dateSeed}`;
  const competitors = getDailyTournamentCompetitors();

  const now = Date.now();
  const lastSim = parseInt(localStorage.getItem(lastSimKey) || '0', 10);
  const elapsedSec = (now - lastSim) / 1000;
  localStorage.setItem(lastSimKey, String(now));

  // Determine how many competitors gain a point based on time passed
  let countToAdvance = 1;
  if (elapsedSec > 180) {
    countToAdvance = 3;
  } else if (elapsedSec > 60) {
    countToAdvance = 2;
  } else if (Math.random() < 0.4) {
    countToAdvance = 1;
  } else {
    countToAdvance = 0;
  }

  // Advance randomly selected non-top rivals, occasionally top 3
  for (let k = 0; k < countToAdvance; k++) {
    const idx = Math.floor(Math.random() * competitors.length);
    competitors[idx].points += 1;
  }

  // Re-sort rivals descending
  competitors.sort((a, b) => b.points - a.points);
  competitors.forEach((c, i) => {
    c.rank = i + 1;
  });

  localStorage.setItem(todayKey, JSON.stringify(competitors));
}

/**
 * Calculates rank and surrounding competitors dynamically based on user's real points.
 * Fully supports 1st place Champion status and defense.
 */
export function calculateRankUp(prevUserPoints: number, earnedPoints: number): RankUpResult {
  const newUserPoints = prevUserPoints + earnedPoints;
  const rawCompetitors = getDailyTournamentCompetitors();

  // Find user's exact rank before
  let prevRank = 1;
  for (const c of rawCompetitors) {
    if (c.points > prevUserPoints) prevRank++;
  }
  prevRank = Math.min(50, Math.max(1, prevRank));

  // Find user's exact rank after
  let newRank = 1;
  for (const c of rawCompetitors) {
    if (c.points > newUserPoints) newRank++;
  }
  newRank = Math.min(50, Math.max(1, newRank));

  // Top 3 Podium (with user placed on top if 1st, 2nd, or 3rd)
  let top3: PodiumEntry[];

  if (newRank === 1) {
    // User is 1st Place Champion!
    top3 = [
      {
        rank: 2,
        name: rawCompetitors[0]?.name || 'RJEA3M',
        avatar: rawCompetitors[0]?.avatar || '🦁',
        avatarBg: rawCompetitors[0]?.avatarBg || '#FED7AA',
        points: rawCompetitors[0]?.points || 30,
        cylinderColor: 'var(--podium-silver)',
      },
      {
        rank: 1,
        name: 'あなた 👑',
        avatar: '🐶',
        avatarBg: '#FEF3C7',
        points: newUserPoints,
        cylinderColor: 'var(--podium-gold)',
      },
      {
        rank: 3,
        name: rawCompetitors[1]?.name || 'VBB7VC',
        avatar: rawCompetitors[1]?.avatar || '🐶',
        avatarBg: rawCompetitors[1]?.avatarBg || '#BFDBFE',
        points: rawCompetitors[1]?.points || 27,
        cylinderColor: 'var(--podium-bronze)',
      },
    ];
  } else if (newRank === 2) {
    // User is 2nd Place!
    top3 = [
      {
        rank: 2,
        name: 'あなた',
        avatar: '🐶',
        avatarBg: '#FEF3C7',
        points: newUserPoints,
        cylinderColor: 'var(--podium-silver)',
      },
      {
        rank: 1,
        name: rawCompetitors[0]?.name || 'RJEA3M',
        avatar: rawCompetitors[0]?.avatar || '🦁',
        avatarBg: rawCompetitors[0]?.avatarBg || '#FED7AA',
        points: rawCompetitors[0]?.points || 30,
        cylinderColor: 'var(--podium-gold)',
      },
      {
        rank: 3,
        name: rawCompetitors[1]?.name || 'VBB7VC',
        avatar: rawCompetitors[1]?.avatar || '🐶',
        avatarBg: rawCompetitors[1]?.avatarBg || '#BFDBFE',
        points: rawCompetitors[1]?.points || 27,
        cylinderColor: 'var(--podium-bronze)',
      },
    ];
  } else {
    // Normal Top 3 Rivals
    top3 = [
      {
        rank: 2,
        name: rawCompetitors[1]?.name || 'VBB7VC',
        avatar: rawCompetitors[1]?.avatar || '🐶',
        avatarBg: rawCompetitors[1]?.avatarBg || '#BFDBFE',
        points: rawCompetitors[1]?.points || 27,
        cylinderColor: 'var(--podium-silver)',
      },
      {
        rank: 1,
        name: rawCompetitors[0]?.name || 'RJEA3M',
        avatar: rawCompetitors[0]?.avatar || '🦁',
        avatarBg: rawCompetitors[0]?.avatarBg || '#FED7AA',
        points: rawCompetitors[0]?.points || 30,
        cylinderColor: 'var(--podium-gold)',
      },
      {
        rank: 3,
        name: rawCompetitors[2]?.name || 'xenW',
        avatar: rawCompetitors[2]?.avatar || '🐊',
        avatarBg: rawCompetitors[2]?.avatarBg || '#BBF7D0',
        points: rawCompetitors[2]?.points || 25,
        cylinderColor: 'var(--podium-bronze)',
      },
    ];
  }

  // Build dynamic 3-card window
  const displayList: TournamentEntry[] = [];

  if (newRank === 1) {
    // User is defending 1st place!
    const rival2nd = rawCompetitors[0] || { name: 'RJEA3M', avatar: '🦁', avatarBg: '#FED7AA', points: 30 };
    const rival3rd = rawCompetitors[1] || { name: 'VBB7VC', avatar: '🐶', avatarBg: '#BFDBFE', points: 27 };

    displayList.push({
      rank: 1,
      name: 'あなた (👑 チャンピオン防衛中！)',
      avatar: '🐶',
      avatarBg: '#FEF3C7',
      points: newUserPoints,
      isUser: true,
    });
    displayList.push({
      rank: 2,
      name: rival2nd.name,
      avatar: rival2nd.avatar,
      avatarBg: rival2nd.avatarBg,
      points: rival2nd.points,
    });
    displayList.push({
      rank: 3,
      name: rival3rd.name,
      avatar: rival3rd.avatar,
      avatarBg: rival3rd.avatarBg,
      points: rival3rd.points,
    });

    return {
      prevRank,
      newRank: 1,
      prevPoints: prevUserPoints,
      earnedPoints,
      newPoints: newUserPoints,
      top3,
      displayList,
      userIndexBefore: 0,
      userIndexAfter: 0,
    };
  }

  // Normal climbing mode:
  // Card 0: Rival ahead (newRank - 1)
  // Card 1: Rival to be overtaken (newRank)
  // Card 2: User (starts at prevRank, overtakes to newRank)
  const aboveIndex = Math.max(0, newRank - 2);
  const rivalAbove = rawCompetitors[aboveIndex] || {
    rank: Math.max(1, newRank - 1),
    name: 'B94N36',
    avatar: '🐊',
    avatarBg: '#DCFCE7',
    points: newUserPoints + 2,
  };

  const overtakeIndex = Math.max(0, newRank - 1);
  const rivalOvertaken = rawCompetitors[overtakeIndex] || {
    rank: newRank,
    name: 'Tomoko',
    avatar: '🐼',
    avatarBg: '#E2E8F0',
    points: Math.max(0, newUserPoints - 1),
  };

  const pointsAbove = Math.max(newUserPoints + 1, rivalAbove.points);
  const pointsOvertaken = Math.min(Math.max(0, newUserPoints - 1), rivalOvertaken.points);

  displayList.push({
    rank: Math.max(1, newRank - 1),
    name: rivalAbove.name,
    avatar: rivalAbove.avatar,
    avatarBg: rivalAbove.avatarBg,
    points: pointsAbove,
  });

  displayList.push({
    rank: newRank,
    name: rivalOvertaken.name,
    avatar: rivalOvertaken.avatar,
    avatarBg: rivalOvertaken.avatarBg,
    points: pointsOvertaken,
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


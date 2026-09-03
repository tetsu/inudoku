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

/**
 * Generate daily leaderboard for the given date.
 */
export function getDailyLeaderboard(userScore: number = 0, userTimeSecs: number = 0): LeaderboardEntry[] {
  const dateSeed = getDateSeed();
  const rng = mulberry32(dateSeed);


  // Generate 25 AI competitors
  const competitors: { name: string; avatar: string; score: number; timeSecs: number }[] = [];
  const usedNames = new Set<string>();

  // Base top score around 3200 - 3800
  let topScore = 3200 + Math.floor(rng() * 600);

  for (let i = 0; i < 24; i++) {
    let name = SHIBA_NAMES[Math.floor(rng() * SHIBA_NAMES.length)];
    while (usedNames.has(name)) {
      name += Math.floor(rng() * 90 + 10);
    }
    usedNames.add(name);

    const avatar = AVATARS[Math.floor(rng() * AVATARS.length)];
    // Descending scores
    const score = Math.max(120, topScore - Math.floor(rng() * 80 + 40));
    topScore = score;

    const timeSecs = Math.floor(45 + rng() * 180);
    competitors.push({ name, avatar, score, timeSecs });
  }

  // Include user if played
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

  // Sort descending by score, then ascending by time
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

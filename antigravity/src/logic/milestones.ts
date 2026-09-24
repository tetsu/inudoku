/**
 * Stage-clear milestone rewards.
 *
 * Shibadoku has no ending (levels run to MAX_STAGE_LEVEL), so milestones repeat
 * every MILESTONE_INTERVAL clears rather than firing once. Hints are the reward
 * because they are the game's only consumable, and until now the sole way to
 * gain any was placing first on the daily leaderboard -- a player who never
 * placed could run out permanently.
 *
 * The larger payouts sit on the levels where generated puzzles step up a size
 * class (see getStageByLevel), so the player's stock is topped up right before
 * the difficulty jumps.
 */
export const MILESTONE_INTERVAL = 10;

/** Clear counts that pay the larger reward, aligned with difficulty step-ups. */
const MAJOR_MILESTONES = [30, 100, 500];

const MINOR_REWARD = 2;
const MAJOR_REWARD = 5;

export interface MilestoneReward {
  /** The clear count reached, e.g. 30. */
  milestone: number;
  /** Hints granted. */
  hints: number;
  /** True for the bigger payouts, so the UI can present them differently. */
  isMajor: boolean;
}

/**
 * Returns the reward for having just reached `clearedCount` distinct cleared
 * stages, or null when that count is not a milestone.
 *
 * Only exact multiples count, so replaying an already-cleared stage (which does
 * not change the distinct count) cannot pay out again. Callers must still check
 * storage.hasMilestoneClaimed() to stay idempotent across sessions.
 */
export function getMilestoneReward(clearedCount: number): MilestoneReward | null {
  if (!Number.isFinite(clearedCount) || clearedCount <= 0) return null;
  if (clearedCount % MILESTONE_INTERVAL !== 0) return null;

  const isMajor = MAJOR_MILESTONES.includes(clearedCount);
  return {
    milestone: clearedCount,
    hints: isMajor ? MAJOR_REWARD : MINOR_REWARD,
    isMajor,
  };
}

/**
 * Clears remaining until the next milestone; used for the title-screen progress
 * label so the running total means something again.
 */
export function clearsUntilNextMilestone(clearedCount: number): number {
  const count = Math.max(0, Math.floor(clearedCount));
  return MILESTONE_INTERVAL - (count % MILESTONE_INTERVAL);
}

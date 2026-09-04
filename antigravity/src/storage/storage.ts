import { CellMark, GameSettings } from '../logic/types';

export interface ActiveGameState {
  stageIndex: number;
  elapsedSeconds: number;
  marks: CellMark[][];
  puzzleId: string;
  lives: number;
  timestamp: number;
}

export interface CompletedLevelStats {
  timeSecs: number;
  score: number;
}

export interface DailyScoreRecord {
  score: number;
  timeSecs: number;
}

/**
 * Storage keys with automatic backward-compatibility migration from legacy "inudoku_*" keys.
 */
export const STORAGE_KEYS = {
  SETTINGS: 'shibadoku_settings',
  UNLOCKED_LEVEL: 'shibadoku_unlocked_level',
  COMPLETED_LEVELS: 'shibadoku_completed_levels',
  ACTIVE_GAME: 'shibadoku_active_game',
  TOURNAMENT_POINTS: 'shibadoku_tournament_points',
  SCORE_PREFIX: 'shibadoku_score_',
  RIVALS_PREFIX: 'shibadoku_rivals_',
  TOURNAMENT_DAILY_PREFIX: 'shibadoku_tournament_points_',

  // Legacy keys for fallback
  LEGACY_SETTINGS: 'inudoku_settings',
  LEGACY_UNLOCKED_LEVEL: 'inudoku_unlocked_level',
  LEGACY_COMPLETED_LEVELS: 'inudoku_completed_levels',
  LEGACY_ACTIVE_GAME: 'inudoku_active_game',
  LEGACY_TOURNAMENT_POINTS: 'inudoku_tournament_points',
  LEGACY_SCORE_PREFIX: 'inudoku_score_',
  LEGACY_RIVALS_PREFIX: 'inudoku_rivals_',
  LEGACY_TOURNAMENT_DAILY_PREFIX: 'inudoku_tournament_points_',
} as const;

export class StorageManager {
  private static instance: StorageManager;

  private constructor() {
    this.migrateLegacyKeys();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * One-time silent migration from old inudoku_* keys to shibadoku_*
   */
  private migrateLegacyKeys() {
    try {
      const migrations: [string, string][] = [
        [STORAGE_KEYS.LEGACY_SETTINGS, STORAGE_KEYS.SETTINGS],
        [STORAGE_KEYS.LEGACY_UNLOCKED_LEVEL, STORAGE_KEYS.UNLOCKED_LEVEL],
        [STORAGE_KEYS.LEGACY_COMPLETED_LEVELS, STORAGE_KEYS.COMPLETED_LEVELS],
        [STORAGE_KEYS.LEGACY_ACTIVE_GAME, STORAGE_KEYS.ACTIVE_GAME],
        [STORAGE_KEYS.LEGACY_TOURNAMENT_POINTS, STORAGE_KEYS.TOURNAMENT_POINTS],
      ];

      for (const [oldKey, newKey] of migrations) {
        const val = localStorage.getItem(oldKey);
        if (val !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, val);
        }
      }
    } catch (e) {
      console.warn('StorageManager: Migration failed or private browsing restriction', e);
    }
  }

  private safeGetItem(key: string, legacyKey?: string): string | null {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
      if (legacyKey) {
        const legVal = localStorage.getItem(legacyKey);
        if (legVal !== null) {
          // Cache to new key
          try {
            localStorage.setItem(key, legVal);
          } catch {
            // Ignore quota errors on migration
          }
          return legVal;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`StorageManager: Failed to write "${key}" to localStorage`, e);
      return false;
    }
  }

  private safeRemoveItem(key: string, legacyKey?: string): void {
    try {
      localStorage.removeItem(key);
      if (legacyKey) {
        localStorage.removeItem(legacyKey);
      }
    } catch (e) {
      console.warn(`StorageManager: Failed to remove "${key}"`, e);
    }
  }

  // --- Settings ---
  public getSettings(defaults: GameSettings): GameSettings {
    const raw = this.safeGetItem(STORAGE_KEYS.SETTINGS, STORAGE_KEYS.LEGACY_SETTINGS);
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  public saveSettings(settings: GameSettings): void {
    this.safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- Unlocked Level ---
  public getUnlockedLevel(): number {
    const raw = this.safeGetItem(STORAGE_KEYS.UNLOCKED_LEVEL, STORAGE_KEYS.LEGACY_UNLOCKED_LEVEL);
    if (!raw) return 1;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }

  public saveUnlockedLevel(level: number): void {
    this.safeSetItem(STORAGE_KEYS.UNLOCKED_LEVEL, String(level));
  }

  // --- Completed Levels ---
  public getCompletedLevels(): Record<number, CompletedLevelStats> {
    const raw = this.safeGetItem(STORAGE_KEYS.COMPLETED_LEVELS, STORAGE_KEYS.LEGACY_COMPLETED_LEVELS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  public saveCompletedLevels(levels: Record<number, CompletedLevelStats>): void {
    this.safeSetItem(STORAGE_KEYS.COMPLETED_LEVELS, JSON.stringify(levels));
  }

  // --- Active Game Cache ---
  public getActiveGame(): ActiveGameState | null {
    const raw = this.safeGetItem(STORAGE_KEYS.ACTIVE_GAME, STORAGE_KEYS.LEGACY_ACTIVE_GAME);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public saveActiveGame(state: ActiveGameState): void {
    this.safeSetItem(STORAGE_KEYS.ACTIVE_GAME, JSON.stringify(state));
  }

  public clearActiveGame(): void {
    this.safeRemoveItem(STORAGE_KEYS.ACTIVE_GAME, STORAGE_KEYS.LEGACY_ACTIVE_GAME);
  }

  // --- Daily Tournament Points & Score ---
  public getDailyTournamentPoints(dateStr?: string): number {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${STORAGE_KEYS.TOURNAMENT_DAILY_PREFIX}${today}`;
    const legacyKey = `${STORAGE_KEYS.LEGACY_TOURNAMENT_DAILY_PREFIX}${today}`;
    const raw = this.safeGetItem(key, legacyKey) || this.safeGetItem(STORAGE_KEYS.TOURNAMENT_POINTS, STORAGE_KEYS.LEGACY_TOURNAMENT_POINTS);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  public saveDailyTournamentPoints(points: number, dateStr?: string): void {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${STORAGE_KEYS.TOURNAMENT_DAILY_PREFIX}${today}`;
    this.safeSetItem(key, String(points));
    this.safeSetItem(STORAGE_KEYS.TOURNAMENT_POINTS, String(points));
  }

  public getDailyScore(dateStr?: string): DailyScoreRecord | null {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${STORAGE_KEYS.SCORE_PREFIX}${today}`;
    const legacyKey = `${STORAGE_KEYS.LEGACY_SCORE_PREFIX}${today}`;
    const raw = this.safeGetItem(key, legacyKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public saveDailyScore(record: DailyScoreRecord, dateStr?: string): void {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${STORAGE_KEYS.SCORE_PREFIX}${today}`;
    this.safeSetItem(key, JSON.stringify(record));
  }

  // --- Rivals ---
  public getRivals(dateSeed: number): string | null {
    const key = `${STORAGE_KEYS.RIVALS_PREFIX}${dateSeed}`;
    const legacyKey = `${STORAGE_KEYS.LEGACY_RIVALS_PREFIX}${dateSeed}`;
    return this.safeGetItem(key, legacyKey);
  }

  public saveRivals(dateSeed: number, rivalsJson: string): void {
    const key = `${STORAGE_KEYS.RIVALS_PREFIX}${dateSeed}`;
    this.safeSetItem(key, rivalsJson);
  }

  // --- Reset All Progress ---
  public resetAllProgress(): void {
    this.safeRemoveItem(STORAGE_KEYS.UNLOCKED_LEVEL, STORAGE_KEYS.LEGACY_UNLOCKED_LEVEL);
    this.safeRemoveItem(STORAGE_KEYS.COMPLETED_LEVELS, STORAGE_KEYS.LEGACY_COMPLETED_LEVELS);
    this.safeRemoveItem(STORAGE_KEYS.ACTIVE_GAME, STORAGE_KEYS.LEGACY_ACTIVE_GAME);
    this.safeRemoveItem(STORAGE_KEYS.TOURNAMENT_POINTS, STORAGE_KEYS.LEGACY_TOURNAMENT_POINTS);
  }
}

export const storage = StorageManager.getInstance();

export type CellMark = 'empty' | 'dog' | 'cross' | 'dot' | 'question';

export interface Position {
  r: number;
  c: number;
}

export interface PuzzleDefinition {
  id: string;
  name: string;
  size: number;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
  /**
   * 2D array of region IDs (0 to size-1).
   * grid[r][c] represents the color region index of that cell.
   */
  regions: number[][];
  /**
   * Unique solution positions for the dogs: array of {r, c} length `size`.
   */
  solution?: Position[];
  hintText?: string;
}

export interface CellState {
  r: number;
  c: number;
  region: number;
  mark: CellMark;
  isConflict: boolean;
  isClue?: boolean;
}

export interface MoveAction {
  r: number;
  c: number;
  prevMark: CellMark;
  newMark: CellMark;
}

export interface GameSettings {
  autoMark: boolean; // Auto-cross cells around placed dog
  soundEnabled: boolean;
  shibaType: 'aka' | 'kuro' | 'shiro'; // 赤柴, 黒柴, 白柴
  highContrast: boolean;
  language?: 'auto' | 'ja' | 'en';
}

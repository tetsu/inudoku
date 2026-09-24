import { PuzzleDefinition } from './types';

/**
 * Guided first-run stages, played before level 1.
 *
 * Each stage leans on one rule. The engine still enforces every rule -- it
 * accepts only the solution cell, so switching rules off would make a move that
 * is legal under the "taught" rules get rejected as simply wrong, which teaches
 * the wrong lesson. The focus comes from the board instead: pre-placed clue dogs
 * (with their crosses already drawn) remove everything but the idea at hand,
 * and the help given shrinks from stage to stage.
 *
 *   T1  4x4, 3 clues -> one open cell left. Learn double-tap, one dog per area.
 *   T2  5x5, 2 clues -> row 1 has a single open cell; rows/columns do the rest.
 *   T3  5x5, 1 clue  -> no single-cell row; the no-touching rule decides it.
 *
 * Every board was checked by brute force to have exactly one solution with its
 * clues (T2 and T3 are unique even without them).
 *
 * These are deliberately not levels: they never touch unlockedLevel,
 * completedLevels or the milestone count, so adding them does not shift any
 * existing player's progress.
 */
export const TUTORIAL_STAGES: PuzzleDefinition[] = [
  {
    id: 'tutorial-1',
    name: 'Tutorial 1',
    size: 4,
    difficulty: 'beginner',
    regions: [
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [2, 2, 3, 3],
      [2, 2, 3, 3],
    ],
    solution: [
      { r: 0, c: 1 },
      { r: 1, c: 3 },
      { r: 2, c: 0 },
      { r: 3, c: 2 },
    ],
    clues: [
      { r: 0, c: 1 },
      { r: 1, c: 3 },
      { r: 2, c: 0 },
    ],
  },
  {
    id: 'tutorial-2',
    name: 'Tutorial 2',
    size: 5,
    difficulty: 'beginner',
    regions: [
      [0, 0, 1, 4, 4],
      [0, 0, 1, 1, 4],
      [2, 2, 2, 1, 4],
      [2, 3, 3, 4, 4],
      [3, 3, 4, 4, 4],
    ],
    solution: [
      { r: 0, c: 1 },
      { r: 1, c: 3 },
      { r: 2, c: 0 },
      { r: 3, c: 2 },
      { r: 4, c: 4 },
    ],
    clues: [
      { r: 0, c: 1 },
      { r: 4, c: 4 },
    ],
  },
  {
    id: 'tutorial-3',
    name: 'Tutorial 3',
    size: 5,
    difficulty: 'beginner',
    regions: [
      [4, 4, 0, 0, 1],
      [4, 2, 0, 0, 1],
      [4, 2, 2, 1, 1],
      [4, 4, 2, 3, 3],
      [4, 4, 2, 3, 3],
    ],
    solution: [
      { r: 0, c: 2 },
      { r: 1, c: 4 },
      { r: 2, c: 1 },
      { r: 3, c: 3 },
      { r: 4, c: 0 },
    ],
    clues: [{ r: 2, c: 1 }],
  },
];

/** i18n key for each stage's instruction, indexed like TUTORIAL_STAGES. */
export const TUTORIAL_INSTRUCTION_KEYS = [
  'tutorial.step1',
  'tutorial.step2',
  'tutorial.step3',
];

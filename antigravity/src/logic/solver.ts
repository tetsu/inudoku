import { Position, PuzzleDefinition } from './types';

export interface SolverResult {
  hasSolution: boolean;
  isUnique: boolean;
  solutions: Position[][];
}

/**
 * Solve a Queens puzzle with backtracking.
 * Finds up to `maxSolutions` solutions.
 */
export function solvePuzzle(
  puzzle: PuzzleDefinition,
  maxSolutions: number = 2
): SolverResult {
  const size = puzzle.size;
  const solutions: Position[][] = [];
  const colOccupied = new Uint8Array(size);
  const regionOccupied = new Uint8Array(size);
  const dogPositions: Position[] = [];

  function canPlace(r: number, c: number): boolean {
    if (colOccupied[c]) return false;
    const reg = puzzle.regions[r][c];
    if (regionOccupied[reg]) return false;

    // Check adjacent row (r-1)
    if (dogPositions.length > 0) {
      const prev = dogPositions[dogPositions.length - 1];
      if (Math.abs(prev.c - c) <= 1) {
        return false;
      }
    }
    return true;
  }

  function search(r: number) {
    if (solutions.length >= maxSolutions) return;

    if (r === size) {
      solutions.push([...dogPositions]);
      return;
    }

    for (let c = 0; c < size; c++) {
      if (!canPlace(r, c)) continue;

      const reg = puzzle.regions[r][c];
      colOccupied[c] = 1;
      regionOccupied[reg] = 1;
      dogPositions.push({ r, c });

      search(r + 1);

      dogPositions.pop();
      colOccupied[c] = 0;
      regionOccupied[reg] = 0;
    }
  }

  search(0);

  return {
    hasSolution: solutions.length > 0,
    isUnique: solutions.length === 1,
    solutions,
  };
}

/**
 * Get a hint for the user based on the puzzle's unique solution
 */
export function getNextHint(
  puzzle: PuzzleDefinition,
  currentDogs: Position[],
  solution?: Position[]
): {
  type: 'place' | 'eliminate' | 'clear-conflict';
  pos: Position;
  reason: string;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
} | null {
  const sol = solution || puzzle.solution || solvePuzzle(puzzle, 1).solutions[0];
  if (!sol) return null;

  const solMap = new Set(sol.map((p) => `${p.r},${p.c}`));

  // 1. Check if any placed dog is wrong (not in solution)
  for (const dog of currentDogs) {
    if (!solMap.has(`${dog.r},${dog.c}`)) {
      return {
        type: 'clear-conflict',
        pos: dog,
        reason: 'ここにいる柴犬は他の柴犬とケンカしてしまう場所にあるワン！場所を見直してみよう。',
        reasonKey: 'msg.hint.conflict',
      };
    }
  }

  // 2. Recommend a correct placement from solution that isn't placed yet
  const placedMap = new Set(currentDogs.map((p) => `${p.r},${p.c}`));
  for (const p of sol) {
    if (!placedMap.has(`${p.r},${p.c}`)) {
      const regionIndex = puzzle.regions[p.r][p.c] + 1;
      return {
        type: 'place',
        pos: p,
        reason: `${p.r + 1}行目、エリア ${regionIndex} に柴犬を配置できるチャンスだワン！`,
        reasonKey: 'msg.hint.place',
        reasonParams: { row: p.r + 1, regionIndex },
      };
    }
  }

  return null;
}

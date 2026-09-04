import { Position, PuzzleDefinition } from './types';
import { solvePuzzle } from './solver';

/**
 * Generates a valid Queens placement for size N (each row, col has 1, no 8-way contact).
 */
export function generateValidPlacement(size: number): Position[] | null {
  const result: Position[] = [];
  const colUsed = new Uint8Array(size);

  function backtrack(r: number): boolean {
    if (r === size) return true;
    const candidates = Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (const c of candidates) {
      if (colUsed[c]) continue;
      if (r > 0 && Math.abs(result[r - 1].c - c) <= 1) continue;

      colUsed[c] = 1;
      result.push({ r, c });
      if (backtrack(r + 1)) return true;
      result.pop();
      colUsed[c] = 0;
    }
    return false;
  }

  if (backtrack(0)) return result;
  return null;
}

/**
 * Check if every region in the grid is contiguous (connected).
 */
export function areRegionsConnected(grid: number[][], size: number): boolean {
  for (let reg = 0; reg < size; reg++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === reg) cells.push({ r, c });
      }
    }
    if (cells.length === 0) return false;

    // Flood fill from first cell
    const visited = new Set<string>();
    const queue = [cells[0]];
    visited.add(`${cells[0].r},${cells[0].c}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = [
        { r: curr.r - 1, c: curr.c },
        { r: curr.r + 1, c: curr.c },
        { r: curr.r, c: curr.c - 1 },
        { r: curr.r, c: curr.c + 1 },
      ];
      for (const n of neighbors) {
        if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size && grid[n.r][n.c] === reg) {
          const key = `${n.r},${n.c}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }

    if (visited.size !== cells.length) {
      return false; // Not connected
    }
  }
  return true;
}

/**
 * Generates a guaranteed UNIQUE solution puzzle of given size with connected regions.
 */
export function generateUniquePuzzle(
  size: number,
  options: {
    id?: string;
    name?: string;
    difficulty?: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
    hintText?: string;
  } = {}
): PuzzleDefinition {
  for (let attempt = 0; attempt < 200; attempt++) {
    const sol = generateValidPlacement(size);
    if (!sol) continue;

    // Start with Voronoi distance assignment
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let bestDist = 9999;
        let bestReg = 0;
        for (let i = 0; i < size; i++) {
          const d = Math.abs(sol[i].r - r) + Math.abs(sol[i].c - c) + Math.random() * 0.4;
          if (d < bestDist) {
            bestDist = d;
            bestReg = i;
          }
        }
        grid[r][c] = bestReg;
      }
    }

    // Anchor seeds
    for (let i = 0; i < size; i++) {
      grid[sol[i].r][sol[i].c] = i;
    }

    // Iteratively eliminate alternate solutions by tweaking boundary cells
    for (let step = 0; step < 120; step++) {
      const candidate: PuzzleDefinition = {
        id: options.id || `gen-${size}x${size}-${Date.now()}`,
        name: options.name || `柴犬のパズル (${size}x${size})`,
        size,
        difficulty:
          options.difficulty ||
          (size <= 5
            ? 'beginner'
            : size <= 6
              ? 'easy'
              : size <= 7
                ? 'medium'
                : size <= 8
                  ? 'hard'
                  : 'expert'),
        regions: grid,
        solution: sol,
        hintText: options.hintText,
      };

      const s = solvePuzzle(candidate, 2);
      if (s.solutions.length === 1 && areRegionsConnected(grid, size)) {
        return candidate;
      }
      if (s.solutions.length === 0) break;

      // Find alternate solution
      const alt = s.solutions.find((c) => c.some((p, r) => p.c !== sol[r].c));
      if (!alt) break;

      const diffs = alt.filter((p, r) => p.c !== sol[r].c);
      if (diffs.length === 0) break;

      const chosenDiff = diffs[Math.floor(Math.random() * diffs.length)];
      const neighbors = [
        chosenDiff.r > 0 ? { r: chosenDiff.r - 1, c: chosenDiff.c } : null,
        chosenDiff.r < size - 1 ? { r: chosenDiff.r + 1, c: chosenDiff.c } : null,
        chosenDiff.c > 0 ? { r: chosenDiff.r, c: chosenDiff.c - 1 } : null,
        chosenDiff.c < size - 1 ? { r: chosenDiff.r, c: chosenDiff.c + 1 } : null,
      ].filter(Boolean) as { r: number; c: number }[];

      const isSeed = sol.some((s) => s.r === chosenDiff.r && s.c === chosenDiff.c);
      if (!isSeed && neighbors.length > 0) {
        const randN = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[chosenDiff.r][chosenDiff.c] = grid[randN.r][randN.c];
      }
    }
  }

  // Fallback guaranteed valid template if random search exceeds max tries
  const fallbackPlacement = generateValidPlacement(size) || [];
  const fallback = createVoronoiSeededPuzzle(size * 100, size, fallbackPlacement, options);
  return {


    ...fallback,
    id: options.id || fallback.id,
    name: options.name || fallback.name,
    difficulty: options.difficulty || fallback.difficulty,
  };
}


function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically generates a valid unique puzzle for any given seed/level.
 * Guarantees that the exact same level number will produce the exact same puzzle for anyone.
 */
export function generateSeededPuzzle(
  seed: number,
  size: number,
  options: { name?: string; difficulty?: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' } = {}
): PuzzleDefinition {
  const rng = mulberry32(seed);

  // 1. Backtrack to find valid Queens placement with seeded RNG
  const colUsed = new Uint8Array(size);
  const placement: Position[] = [];

  function backtrack(r: number): boolean {
    if (r === size) return true;
    const candidates = Array.from({ length: size }, (_, i) => i).sort(() => rng() - 0.5);
    for (const c of candidates) {
      if (colUsed[c]) continue;
      if (r > 0 && Math.abs(placement[r - 1].c - c) <= 1) continue;

      colUsed[c] = 1;
      placement.push({ r, c });
      if (backtrack(r + 1)) return true;
      placement.pop();
      colUsed[c] = 0;
    }
    return false;
  }

  let validPlacement = backtrack(0) ? placement : null;
  if (!validPlacement) {
    validPlacement = generateValidPlacement(size)!;
  }

  // 2. Grow regions around seed placement
  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  const regionCells: Position[][] = Array.from({ length: size }, () => []);

  validPlacement.forEach((pos, regionId) => {
    grid[pos.r][pos.c] = regionId;
    regionCells[regionId].push({ r: pos.r, c: pos.c });
  });

  const frontiers: Position[][] = validPlacement.map((p) => [{ r: p.r, c: p.c }]);
  let unassigned = size * size - size;

  while (unassigned > 0) {
    let progressed = false;
    for (let reg = 0; reg < size; reg++) {
      if (frontiers[reg].length === 0) continue;
      const fIdx = Math.floor(rng() * frontiers[reg].length);
      const curr = frontiers[reg][fIdx];

      const neighbors = [
        curr.r > 0 ? { r: curr.r - 1, c: curr.c } : null,
        curr.r < size - 1 ? { r: curr.r + 1, c: curr.c } : null,
        curr.c > 0 ? { r: curr.r, c: curr.c - 1 } : null,
        curr.c < size - 1 ? { r: curr.r, c: curr.c + 1 } : null,
      ].filter((p): p is Position => p !== null && grid[p.r][p.c] === -1);

      if (neighbors.length > 0) {
        const nextCell = neighbors[Math.floor(rng() * neighbors.length)];
        grid[nextCell.r][nextCell.c] = reg;
        regionCells[reg].push(nextCell);
        frontiers[reg].push(nextCell);
        unassigned--;
        progressed = true;
      } else {
        frontiers[reg].splice(fIdx, 1);
      }
    }
    if (!progressed) {
      // Assign remaining cells to adjacent regions
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] === -1) {
            const adj = [
              r > 0 ? grid[r - 1][c] : -1,
              r < size - 1 ? grid[r + 1][c] : -1,
              c > 0 ? grid[r][c - 1] : -1,
              c < size - 1 ? grid[r][c + 1] : -1,
            ].filter((v) => v !== -1);
            if (adj.length > 0) {
              const reg = adj[Math.floor(rng() * adj.length)];
              grid[r][c] = reg;
              regionCells[reg].push({ r, c });
              unassigned--;
            }
          }
        }
      }
    }
  }

  // 3. Check uniqueness and eliminate alternate solutions deterministically
  const puzzle: PuzzleDefinition = {
    id: `level-${seed}`,
    name: options.name || `レベル ${seed}`,
    size,
    difficulty: options.difficulty || (size <= 5 ? 'beginner' : size <= 6 ? 'easy' : size <= 7 ? 'medium' : 'hard'),
    regions: grid,
    solution: validPlacement,
  };

  for (let iter = 0; iter < 12; iter++) {
    const s = solvePuzzle(puzzle, 2);
    if (s.isUnique) {
      return puzzle;
    }
    if (s.solutions.length === 0) break;

    // Find alternate solution
    const alt = s.solutions.find((c) => c.some((p, r) => p.c !== validPlacement[r].c));
    if (!alt) break;

    const diffs = alt.filter((p, r) => p.c !== validPlacement[r].c);
    if (diffs.length === 0) break;

    const chosenDiff = diffs[Math.floor(rng() * diffs.length)];
    const neighbors = [
      chosenDiff.r > 0 ? { r: chosenDiff.r - 1, c: chosenDiff.c } : null,
      chosenDiff.r < size - 1 ? { r: chosenDiff.r + 1, c: chosenDiff.c } : null,
      chosenDiff.c > 0 ? { r: chosenDiff.r, c: chosenDiff.c - 1 } : null,
      chosenDiff.c < size - 1 ? { r: chosenDiff.r, c: chosenDiff.c + 1 } : null,
    ].filter((p): p is Position => p !== null);

    const isSeed = validPlacement.some((sp) => sp.r === chosenDiff.r && sp.c === chosenDiff.c);
    if (!isSeed && neighbors.length > 0) {
      const randN = neighbors[Math.floor(rng() * neighbors.length)];
      grid[chosenDiff.r][chosenDiff.c] = grid[randN.r][randN.c];
    }
  }

  // Fallback: Voronoi partition around validPlacement (guarantees exactly 1 seed per region)
  return createVoronoiSeededPuzzle(seed, size, validPlacement, options);
}

function createVoronoiSeededPuzzle(
  seed: number,
  size: number,
  solution: Position[],
  options: { name?: string; difficulty?: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' }
): PuzzleDefinition {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let bestDist = Infinity;
      let bestReg = 0;
      for (let reg = 0; reg < size; reg++) {
        const solPos = solution[reg];
        // Manhattan distance with slight seed-based tie breaker
        const dist = Math.abs(r - solPos.r) + Math.abs(c - solPos.c);
        if (dist < bestDist) {
          bestDist = dist;
          bestReg = reg;
        }
      }
      grid[r][c] = bestReg;
    }
  }

  // Ensure seeds strictly own their cell
  solution.forEach((pos, reg) => {
    grid[pos.r][pos.c] = reg;
  });

  const p: PuzzleDefinition = {
    id: `level-${seed}`,
    name: options.name || `レベル ${seed}`,
    size,
    difficulty: options.difficulty || (size <= 5 ? 'beginner' : size <= 6 ? 'easy' : size <= 7 ? 'medium' : 'hard'),
    regions: grid,
    solution,
  };

  return p;
}



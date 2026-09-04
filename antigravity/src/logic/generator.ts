import { Position, PuzzleDefinition } from './types';
import { solvePuzzle } from './solver';
import { mulberry32 } from './prng';

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
 * Helper: checks if removing a cell from region `reg` keeps the remaining cells of `reg` connected.
 */
export function isRegionStillConnected(grid: number[][], size: number, reg: number): boolean {
  let startR = -1;
  let startC = -1;
  let count = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === reg) {
        count++;
        if (startR === -1) {
          startR = r;
          startC = c;
        }
      }
    }
  }
  if (count <= 1) return true;

  const visited = Array.from({ length: size }, () => new Uint8Array(size));
  const q = [{ r: startR, c: startC }];
  visited[startR][startC] = 1;
  let reached = 1;

  while (q.length > 0) {
    const curr = q.shift()!;
    const neighbors = [
      curr.r > 0 ? { r: curr.r - 1, c: curr.c } : null,
      curr.r < size - 1 ? { r: curr.r + 1, c: curr.c } : null,
      curr.c > 0 ? { r: curr.r, c: curr.c - 1 } : null,
      curr.c < size - 1 ? { r: curr.r, c: curr.c + 1 } : null,
    ];
    for (const n of neighbors) {
      if (n && grid[n.r][n.c] === reg && !visited[n.r][n.c]) {
        visited[n.r][n.c] = 1;
        reached++;
        q.push(n);
      }
    }
  }
  return reached === count;
}

/**
 * Creates Voronoi-based initial partition around solution seeds.
 */
function createVoronoiGrid(size: number, sol: Position[], rng: () => number): number[][] {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let bestDist = 9999;
      let bestReg = 0;
      for (let i = 0; i < size; i++) {
        const d = Math.abs(sol[i].r - r) + Math.abs(sol[i].c - c) + rng() * 0.4;
        if (d < bestDist) {
          bestDist = d;
          bestReg = i;
        }
      }
      grid[r][c] = bestReg;
    }
  }
  for (let i = 0; i < size; i++) {
    grid[sol[i].r][sol[i].c] = i;
  }
  return grid;
}

/**
 * Creates growth-based initial partition around solution seeds.
 */
function createGrowthGrid(size: number, sol: Position[], rng: () => number): number[][] {
  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  sol.forEach((pos, reg) => {
    grid[pos.r][pos.c] = reg;
  });
  const frontiers: Position[][] = sol.map((p) => [{ r: p.r, c: p.c }]);
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
        frontiers[reg].push(nextCell);
        unassigned--;
        progressed = true;
      } else {
        frontiers[reg].splice(fIdx, 1);
      }
    }
    if (!progressed) {
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
              grid[r][c] = adj[Math.floor(rng() * adj.length)];
              unassigned--;
            }
          }
        }
      }
    }
  }
  return grid;
}

/**
 * Generates a guaranteed strictly UNIQUE solution puzzle of given size with connected regions.
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
  const maxAttempts = 300;
  const maxSteps = size <= 7 ? 60 : size === 8 ? 80 : 120;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sol = generateValidPlacement(size);
    if (!sol) continue;

    const grid =
      size >= 10 || attempt % 2 === 1
        ? createGrowthGrid(size, sol, Math.random)
        : createVoronoiGrid(size, sol, Math.random);

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

    for (let step = 0; step < maxSteps; step++) {
      const s = solvePuzzle(candidate, 2);
      if (s.solutions.length === 1 && s.isUnique && areRegionsConnected(grid, size)) {
        return candidate;
      }
      if (s.solutions.length === 0) break;

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
      ].filter((p): p is Position => p !== null);

      const isSeed = sol.some((sp) => sp.r === chosenDiff.r && sp.c === chosenDiff.c);
      if (!isSeed && neighbors.length > 0) {
        const randN = neighbors[Math.floor(Math.random() * neighbors.length)];
        const oldReg = grid[chosenDiff.r][chosenDiff.c];
        const newReg = grid[randN.r][randN.c];
        if (oldReg !== newReg) {
          grid[chosenDiff.r][chosenDiff.c] = newReg;
          if (!isRegionStillConnected(grid, size, oldReg)) {
            grid[chosenDiff.r][chosenDiff.c] = oldReg; // revert
          }
        }
      }
    }
  }

  // If initial search attempts exhausted, continue until guaranteed unique
  return generateSeededPuzzle(Date.now(), size, options);
}

/**
 * Deterministically generates a valid strictly UNIQUE puzzle for any given seed/level.
 * Guarantees that the exact same level number will produce the exact same puzzle for anyone.
 * Absolutely eliminates ambiguous/undetermined 50/50 guessing patterns.
 */
export function generateSeededPuzzle(
  seed: number,
  size: number,
  options: { name?: string; difficulty?: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' } = {}
): PuzzleDefinition {
  const maxSteps = size <= 7 ? 60 : size === 8 ? 80 : 120;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);

    // 1. Backtrack valid Queens placement with seeded RNG
    const colUsed = new Uint8Array(size);
    const sol: Position[] = [];

    function backtrack(r: number): boolean {
      if (r === size) return true;
      const candidates = Array.from({ length: size }, (_, i) => i).sort(() => rng() - 0.5);
      for (const c of candidates) {
        if (colUsed[c]) continue;
        if (r > 0 && Math.abs(sol[r - 1].c - c) <= 1) continue;

        colUsed[c] = 1;
        sol.push({ r, c });
        if (backtrack(r + 1)) return true;
        sol.pop();
        colUsed[c] = 0;
      }
      return false;
    }

    if (!backtrack(0)) continue;

    // 2. Hybrid grid generation: organic Growth for large grids (>=10), alternating Voronoi & Growth for others
    const grid =
      size >= 10 || attempt % 2 === 1
        ? createGrowthGrid(size, sol, rng)
        : createVoronoiGrid(size, sol, rng);

    const puzzle: PuzzleDefinition = {
      id: `level-${seed}`,
      name: options.name || `レベル ${seed}`,
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
    };

    // 3. Iteratively eliminate alternate solutions by tweaking boundary cells
    for (let step = 0; step < maxSteps; step++) {
      const s = solvePuzzle(puzzle, 2);
      if (s.solutions.length === 1 && s.isUnique && areRegionsConnected(grid, size)) {
        return puzzle;
      }
      if (s.solutions.length === 0) break;

      const alt = s.solutions.find((c) => c.some((p, r) => p.c !== sol[r].c));
      if (!alt) break;

      const diffs = alt.filter((p, r) => p.c !== sol[r].c);
      if (diffs.length === 0) break;

      const chosenDiff = diffs[Math.floor(rng() * diffs.length)];
      const neighbors = [
        chosenDiff.r > 0 ? { r: chosenDiff.r - 1, c: chosenDiff.c } : null,
        chosenDiff.r < size - 1 ? { r: chosenDiff.r + 1, c: chosenDiff.c } : null,
        chosenDiff.c > 0 ? { r: chosenDiff.r, c: chosenDiff.c - 1 } : null,
        chosenDiff.c < size - 1 ? { r: chosenDiff.r, c: chosenDiff.c + 1 } : null,
      ].filter((p): p is Position => p !== null);

      const isSeed = sol.some((sp) => sp.r === chosenDiff.r && sp.c === chosenDiff.c);
      if (!isSeed && neighbors.length > 0) {
        const randN = neighbors[Math.floor(rng() * neighbors.length)];
        const oldReg = grid[chosenDiff.r][chosenDiff.c];
        const newReg = grid[randN.r][randN.c];
        if (oldReg !== newReg) {
          grid[chosenDiff.r][chosenDiff.c] = newReg;
          if (!isRegionStillConnected(grid, size, oldReg)) {
            grid[chosenDiff.r][chosenDiff.c] = oldReg; // revert
          }
        }
      }
    }
  }

  // Safety fallback with guaranteed unique generation
  return generateSeededPuzzle(seed + 99991, size, options);
}



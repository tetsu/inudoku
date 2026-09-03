import { CellState, Position, PuzzleDefinition } from './types';

export interface ValidationResult {
  isComplete: boolean;
  conflictingCells: Set<string>; // "r,c"
  completedRows: number[];
  completedCols: number[];
  completedRegions: number[];
  dogCount: number;
}

export function validateGrid(grid: CellState[][], puzzle: PuzzleDefinition): ValidationResult {
  const size = puzzle.size;
  const conflictingCells = new Set<string>();

  // Collect all placed dogs
  const dogPositions: Position[] = [];
  const dogsInRow: number[][] = Array.from({ length: size }, () => []);
  const dogsInCol: number[][] = Array.from({ length: size }, () => []);
  const dogsInRegion: number[][] = Array.from({ length: size }, () => []);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].mark === 'dog') {
        dogPositions.push({ r, c });
        dogsInRow[r].push(c);
        dogsInCol[c].push(r);
        const regionId = grid[r][c].region;
        if (regionId >= 0 && regionId < size) {
          dogsInRegion[regionId].push(r * size + c);
        }
      }
    }
  }

  // 1. Check Row conflicts
  for (let r = 0; r < size; r++) {
    if (dogsInRow[r].length > 1) {
      for (const c of dogsInRow[r]) {
        conflictingCells.add(`${r},${c}`);
      }
    }
  }

  // 2. Check Col conflicts
  for (let c = 0; c < size; c++) {
    if (dogsInCol[c].length > 1) {
      for (const r of dogsInCol[c]) {
        conflictingCells.add(`${r},${c}`);
      }
    }
  }

  // 3. Check Region conflicts
  for (let reg = 0; reg < size; reg++) {
    if (dogsInRegion[reg].length > 1) {
      for (const idx of dogsInRegion[reg]) {
        const r = Math.floor(idx / size);
        const c = idx % size;
        conflictingCells.add(`${r},${c}`);
      }
    }
  }

  // 4. Check 8-way adjacency (Touch/Personal space rule)
  for (let i = 0; i < dogPositions.length; i++) {
    for (let j = i + 1; j < dogPositions.length; j++) {
      const p1 = dogPositions[i];
      const p2 = dogPositions[j];
      const dr = Math.abs(p1.r - p2.r);
      const dc = Math.abs(p1.c - p2.c);

      // Adjacent if distance <= 1 in both dimensions
      if (dr <= 1 && dc <= 1) {
        conflictingCells.add(`${p1.r},${p1.c}`);
        conflictingCells.add(`${p2.r},${p2.c}`);
      }
    }
  }

  // Find fulfilled units
  const completedRows = dogsInRow
    .map((cols, r) => (cols.length === 1 && !conflictingCells.has(`${r},${cols[0]}`) ? r : -1))
    .filter((r) => r !== -1);

  const completedCols = dogsInCol
    .map((rows, c) => (rows.length === 1 && !conflictingCells.has(`${rows[0]},${c}`) ? c : -1))
    .filter((c) => c !== -1);

  const completedRegions = dogsInRegion
    .map((indices, reg) => {
      if (indices.length === 1) {
        const r = Math.floor(indices[0] / size);
        const c = indices[0] % size;
        if (!conflictingCells.has(`${r},${c}`)) return reg;
      }
      return -1;
    })
    .filter((reg) => reg !== -1);

  const isComplete =
    dogPositions.length === size &&
    conflictingCells.size === 0 &&
    completedRows.length === size &&
    completedCols.length === size &&
    completedRegions.length === size;

  return {
    isComplete,
    conflictingCells,
    completedRows,
    completedCols,
    completedRegions,
    dogCount: dogPositions.length,
  };
}

/**
 * Returns list of cells that can be automatically crossed out when placing a dog at (r, c).
 */
export function getAutoCrossCells(
  r: number,
  c: number,
  puzzle: PuzzleDefinition,
  grid: CellState[][]
): Position[] {
  const size = puzzle.size;
  const region = puzzle.regions[r][c];
  const results: Position[] = [];
  const added = new Set<string>();

  const add = (nr: number, nc: number) => {
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      if (nr === r && nc === c) return;
      const key = `${nr},${nc}`;
      if (!added.has(key) && grid[nr][nc].mark === 'empty') {
        added.add(key);
        results.push({ r: nr, c: nc });
      }
    }
  };

  // 1. Surrounding 8 cells
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      add(r + dr, c + dc);
    }
  }

  // 2. Same row
  for (let col = 0; col < size; col++) {
    add(r, col);
  }

  // 3. Same column
  for (let row = 0; row < size; row++) {
    add(row, c);
  }

  // 4. Same region
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (puzzle.regions[row][col] === region) {
        add(row, col);
      }
    }
  }

  return results;
}

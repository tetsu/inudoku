import confetti from 'canvas-confetti';
import { getStageByLevel, MAX_STAGE_LEVEL } from './logic/stages';
import {
  CellMark,
  CellState,
  GameSettings,
  MoveAction,
  Position,
  PuzzleDefinition,
} from './logic/types';
import { getAutoCrossCells, validateGrid } from './logic/validator';
import { getNextHint } from './logic/solver';
import { generateUniquePuzzle } from './logic/generator';
import { sounds } from './audio/sound';
import { getCrossSvg, getQuestionSvg, getShibaSvg, REGION_COLORS, ShibaType } from './graphics/shiba';
import { calculateRankUp, getDailyLeaderboard, simulateRivalPoints } from './logic/leaderboard';
import { storage } from './storage/storage';

class InudokuGame {
  private currentPuzzle: PuzzleDefinition = getStageByLevel(1);

  private currentStageIndex: number = 0;
  private grid: CellState[][] = [];
  private undoStack: MoveAction[][] = [];
  private inputMode: 'dog' | 'mark' = 'mark';
  private focusedPos: Position | null = null;
  private hoveredPos: Position | null = null;
  private inputDevice: 'pointer' | 'keyboard' = 'pointer';

  // Pointer, Drag, Double-Tap & Long-Press tracking
  private isPointerDown: boolean = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownCell: Position | null = null;
  private isDragging: boolean = false;
  private dragMoveGroup: MoveAction[] = [];
  private visitedDragCells: Set<string> = new Set();
  private lastTapInfo: { r: number; c: number; time: number; prevMark: CellMark } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired: boolean = false;

  // Progression & Score
  private unlockedLevel: number = 1;
  private completedLevels: Record<number, { timeSecs: number; score: number }> = {};
  private dailyBestScore: number = 0;
  private dailyBestTimeSecs: number = 0;
  private tournamentPoints: number = 0;
  private lives: number = 3;

  // Settings
  private settings: GameSettings = {
    autoMark: true,
    soundEnabled: true,
    shibaType: 'aka',
    highContrast: false,
  };

  // Timer
  private timerInterval: number | null = null;
  private elapsedSeconds: number = 0;
  private isFinished: boolean = false;
  private hintTimeout: number | null = null;

  // DOM Elements
  private screenTitleEl!: HTMLElement;
  private screenGameEl!: HTMLElement;
  private gridBoardEl!: HTMLElement;
  private dogCounterEl!: HTMLElement;
  private timerValEl!: HTMLElement;
  private levelValEl!: HTMLElement;
  private diffValEl!: HTMLElement;
  private hintBubbleEl!: HTMLElement;
  private hintBubbleTextEl!: HTMLElement;
  private automarkBadgeEl!: HTMLElement;

  constructor() {
    this.loadSavedData();
    this.initDOMElements();
    this.bindEvents();
    this.renderTitleScreen();
    this.setupTitleMascot();
  }

  private loadSavedData() {
    this.settings = storage.getSettings(this.settings);
    sounds.setEnabled(this.settings.soundEnabled);

    this.unlockedLevel = storage.getUnlockedLevel();
    this.completedLevels = storage.getCompletedLevels();

    const daily = storage.getDailyScore();
    if (daily) {
      this.dailyBestScore = daily.score;
      this.dailyBestTimeSecs = daily.timeSecs;
    }

    this.tournamentPoints = storage.getDailyTournamentPoints();
  }

  private saveActiveGame() {
    if (this.isFinished) return;
    const marks: CellMark[][] = this.grid.map((row) => row.map((cell) => cell.mark));
    storage.saveActiveGame({
      stageIndex: this.currentStageIndex,
      elapsedSeconds: this.elapsedSeconds,
      marks,
      puzzleId: this.currentPuzzle.id,
      lives: this.lives,
      timestamp: Date.now(),
    });
  }

  private clearActiveGame() {
    storage.clearActiveGame();
  }

  private getActiveGame() {
    return storage.getActiveGame();
  }

  private saveSettings() {
    storage.saveSettings(this.settings);
    sounds.setEnabled(this.settings.soundEnabled);
    this.updateAutomarkBadge();
  }

  private saveProgression() {
    storage.saveUnlockedLevel(this.unlockedLevel);
    storage.saveCompletedLevels(this.completedLevels);
    storage.saveDailyTournamentPoints(this.tournamentPoints);
    storage.saveDailyScore({
      score: this.dailyBestScore,
      timeSecs: this.dailyBestTimeSecs,
    });
  }

  public setFocusedCell(r: number, c: number) {
    this.inputDevice = 'keyboard';
    // Never show keyboard focus box on touch/mobile devices
    if (window.matchMedia('(pointer: coarse), (hover: none)').matches) {
      return;
    }

    const size = this.currentPuzzle.size;
    if (r < 0 || r >= size || c < 0 || c >= size) return;

    if (this.focusedPos) {
      const prevEl = document.getElementById(`cell-${this.focusedPos.r}-${this.focusedPos.c}`);
      prevEl?.classList.remove('cell-focused');
    }

    this.focusedPos = { r, c };
    const nextEl = document.getElementById(`cell-${r}-${c}`);
    nextEl?.classList.add('cell-focused');
  }

  public clearFocusedCell(keepDevice: boolean = false) {
    if (this.focusedPos) {
      const prevEl = document.getElementById(`cell-${this.focusedPos.r}-${this.focusedPos.c}`);
      prevEl?.classList.remove('cell-focused');
      this.focusedPos = null;
    }
    if (!keepDevice) {
      this.inputDevice = 'pointer';
    }
  }



  private initDOMElements() {
    this.screenTitleEl = document.getElementById('screen-title')!;
    this.screenGameEl = document.getElementById('screen-game')!;
    this.gridBoardEl = document.getElementById('grid-board')!;
    this.dogCounterEl = document.getElementById('dog-counter')!;
    this.timerValEl = document.getElementById('timer-val')!;
    this.levelValEl = document.getElementById('level-val')!;
    this.diffValEl = document.getElementById('difficulty-val')!;
    this.hintBubbleEl = document.getElementById('hint-bubble')!;
    this.hintBubbleTextEl = document.getElementById('hint-bubble-text')!;
    this.automarkBadgeEl = document.getElementById('automark-badge')!;

    this.updateAutomarkBadge();
  }

  private setupTitleMascot() {
    const mascotEl = document.getElementById('title-shiba-mascot');
    if (mascotEl) {
      mascotEl.innerHTML = getShibaSvg(this.settings.shibaType, 'normal');
    }
  }

  private renderTitleScreen() {
    const activeGame = this.getActiveGame();
    const playBtnText = document.querySelector('#btn-title-play .play-text');
    const targetLvl = activeGame ? activeGame.stageIndex + 1 : this.unlockedLevel;

    if (playBtnText) {
      if (activeGame) {
        playBtnText.innerHTML = `つづきから (レベル ${targetLvl}) 🐾`;
      } else {
        playBtnText.innerHTML = `あそぶ (レベル ${targetLvl})`;
      }
    }

    const todayDateEl = document.getElementById('title-today-date');
    if (todayDateEl) {
      const now = new Date();
      todayDateEl.textContent = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
    }

    const progressEl = document.getElementById('title-progress-text');
    if (progressEl) {
      const completedCount = Object.keys(this.completedLevels).length;
      progressEl.textContent = `${completedCount} クリア (Lv.${this.unlockedLevel})`;
    }
  }

  public showTitleScreen() {
    this.stopTimer();
    this.saveActiveGame();
    this.screenGameEl.classList.add('hidden');
    this.screenTitleEl.classList.remove('hidden');
    this.renderTitleScreen();
    this.setupTitleMascot();
  }

  public startGame(levelIndex?: number) {
    const activeGame = this.getActiveGame();
    let targetIndex: number;

    if (levelIndex !== undefined) {
      targetIndex = Math.min(Math.max(0, levelIndex), MAX_STAGE_LEVEL - 1);
      // If choosing a different stage than cached active game, start fresh
      if (activeGame && activeGame.stageIndex !== targetIndex) {
        this.clearActiveGame();
      }
    } else {
      targetIndex = activeGame ? activeGame.stageIndex : Math.min(this.unlockedLevel - 1, MAX_STAGE_LEVEL - 1);
    }

    this.currentStageIndex = targetIndex;
    this.screenTitleEl.classList.add('hidden');
    this.screenGameEl.classList.remove('hidden');

    const targetPuzzle = getStageByLevel(targetIndex + 1);

    const freshActive = this.getActiveGame();
    if (freshActive && freshActive.stageIndex === targetIndex && freshActive.marks) {
      // Resume from saved cached board state!
      this.resumePuzzle(
        targetPuzzle,
        freshActive.marks,
        freshActive.elapsedSeconds,
        freshActive.lives
      );
    } else {
      this.initPuzzle(targetPuzzle);
    }
  }



  public resumePuzzle(puzzle: PuzzleDefinition, savedMarks: CellMark[][], elapsedSecs: number, savedLives?: number) {
    this.currentPuzzle = puzzle;
    this.undoStack = [];
    this.isFinished = false;
    this.elapsedSeconds = elapsedSecs || 0;
    this.lives = savedLives !== undefined ? savedLives : 3;
    this.focusedPos = null;
    this.updateLivesView();
    this.timerValEl.textContent = this.formatTime(this.elapsedSeconds);
    this.startTimer();
    this.hideHint();

    const size = puzzle.size;
    this.grid = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        r,
        c,
        region: puzzle.regions[r][c],
        mark: savedMarks[r]?.[c] || 'empty',
        isConflict: false,
      }))
    );

    if (this.levelValEl) {
      this.levelValEl.textContent = String(this.currentStageIndex + 1);
    }
    if (this.diffValEl) {
      this.diffValEl.textContent = this.getDifficultyLabel(puzzle.difficulty, puzzle.size);
    }
    this.renderBoard();
    this.validateAndCheckWin();
  }

  public initPuzzle(puzzle: PuzzleDefinition) {
    this.currentPuzzle = puzzle;
    this.undoStack = [];
    this.isFinished = false;
    this.lives = 3;
    this.focusedPos = null;
    this.updateLivesView();
    this.resetTimer();
    this.startTimer();
    this.hideHint();
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressFired = false;
    this.pointerDownCell = null;
    this.pointerDownPos = null;
    this.lastTapInfo = null;
    this.hoveredPos = null;

    const size = puzzle.size;
    this.grid = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        r,
        c,
        region: puzzle.regions[r][c],
        mark: 'empty',
        isConflict: false,
      }))
    );

    if (this.levelValEl) {

      this.levelValEl.textContent = String(this.currentStageIndex + 1);
    }
    if (this.diffValEl) {
      this.diffValEl.textContent = this.getDifficultyLabel(puzzle.difficulty, puzzle.size);
    }
    this.renderBoard();
    this.updateStatus();
  }

  private renderBoard() {
    const size = this.currentPuzzle.size;
    this.gridBoardEl.innerHTML = '';
    this.gridBoardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    this.gridBoardEl.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = this.grid[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.dataset.r = String(r);
        cellEl.dataset.c = String(c);
        cellEl.id = `cell-${r}-${c}`;

        // Region color (Solid vibrant pastel matching screenshot)
        const color = REGION_COLORS[cell.region % REGION_COLORS.length];
        cellEl.style.setProperty('--cell-bg', color);

        // No black borders! Pure colorful rounded tiles separated by clean white gaps

        this.renderCellContent(cellEl, cell);
        this.gridBoardEl.appendChild(cellEl);
      }
    }

    if (this.inputDevice === 'keyboard' && this.focusedPos) {
      this.setFocusedCell(this.focusedPos.r, this.focusedPos.c);
    } else {
      this.clearFocusedCell(true);
    }
  }

  private renderCellContent(cellEl: HTMLElement, cell: CellState) {
    cellEl.innerHTML = '';
    cellEl.classList.toggle('cell-conflict', cell.isConflict);

    if (cell.mark === 'dog') {
      const state = cell.isConflict ? 'conflict' : 'normal';
      cellEl.innerHTML = `<div class="cell-dog">${getShibaSvg(this.settings.shibaType, state)}</div>`;
    } else if (cell.mark === 'cross') {
      cellEl.innerHTML = `<div class="cell-cross">${getCrossSvg()}</div>`;
    } else if (cell.mark === 'question') {
      cellEl.innerHTML = `<div class="cell-question">${getQuestionSvg()}</div>`;
    }
  }

  private updateCellView(r: number, c: number) {
    const cellEl = document.getElementById(`cell-${r}-${c}`);
    if (cellEl) {
      this.renderCellContent(cellEl, this.grid[r][c]);
    }
  }

  private updateAllConflicts(conflicts: Set<string>) {
    const size = this.currentPuzzle.size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isConflict = conflicts.has(`${r},${c}`);
        if (this.grid[r][c].isConflict !== isConflict) {
          this.grid[r][c].isConflict = isConflict;
          this.updateCellView(r, c);
        }
      }
    }
  }

  private handleCellClick(r: number, c: number, forceMark?: 'dog' | 'cross' | 'question') {
    if (this.isFinished) return;

    const cell = this.grid[r][c];

    // Direct Question Mark placement / toggle (Middle click, N key, or mobile long press)
    if (forceMark === 'question') {
      const prevMark = cell.mark;
      const newMark: CellMark = cell.mark === 'question' ? 'empty' : 'question';
      cell.mark = newMark;
      this.undoStack.push([{ r, c, prevMark, newMark }]);

      if (newMark === 'question') {
        sounds.playQuestion();
      } else {
        sounds.playErase();
      }

      this.updateCellView(r, c);
      this.saveActiveGame();
      this.validateAndCheckWin();
      return;
    }

    const targetMark = forceMark || (this.inputMode === 'dog' ? 'dog' : 'cross');

    if (targetMark === 'dog') {
      if (cell.mark === 'dog') {
        // Toggle dog off
        const prevMark = cell.mark;
        cell.mark = 'empty';
        this.undoStack.push([{ r, c, prevMark, newMark: 'empty' }]);
        sounds.playErase();
        this.updateCellView(r, c);
        this.validateAndCheckWin();
        return;
      }

      // Note: If cell.mark is 'cross', 'question', or 'empty', it CAN be directly overwritten by a dog!

      // Check collision rules
      const sameRowDog = this.findDogInRow(r, c);
      if (sameRowDog) {
        this.flashDeny(r, c, '同じ横列（行）には1匹しか置けないワン！', sameRowDog);
        sounds.playConflict();
        return;
      }

      const sameColDog = this.findDogInCol(r, c);
      if (sameColDog) {
        this.flashDeny(r, c, '同じ縦列（列）には1匹しか置けないワン！', sameColDog);
        sounds.playConflict();
        return;
      }

      const sameRegionDog = this.findDogInRegion(r, c, cell.region);
      if (sameRegionDog) {
        this.flashDeny(r, c, '同じ色のエリアには1匹しか置けないワン！', sameRegionDog);
        sounds.playConflict();
        return;
      }

      const adjacentDog = this.findAdjacentDog(r, c);
      if (adjacentDog) {
        this.flashDeny(r, c, '柴犬同士が近すぎるワン！（斜めも含めて8マス接触禁止）', adjacentDog);
        sounds.playConflict();
        return;
      }

      // Check if (r, c) is the correct placement for the puzzle
      if (this.currentPuzzle.solution && this.currentPuzzle.solution.length > 0) {
        const isSolutionPosition = this.currentPuzzle.solution.some(
          (s) => s.r === r && s.c === c
        );
        if (!isSolutionPosition) {
          this.flashDeny(r, c, 'そこは柴犬の居場所じゃないワン！（間違ったマスです）');
          sounds.playConflict();
          cell.mark = 'cross';
          this.updateCellView(r, c);
          this.saveActiveGame();
          return;
        }
      }

      // Valid placement! (Overwrites empty or question mark)
      const moveGroup: MoveAction[] = [];
      const prevMark = cell.mark;
      cell.mark = 'dog';
      moveGroup.push({ r, c, prevMark, newMark: 'dog' });

      // Auto-Mark crosses if enabled
      if (this.settings.autoMark) {
        const autoCrosses = getAutoCrossCells(r, c, this.currentPuzzle, this.grid);
        for (const pos of autoCrosses) {
          if (this.grid[pos.r][pos.c].mark === 'empty' || this.grid[pos.r][pos.c].mark === 'question') {
            const oldM = this.grid[pos.r][pos.c].mark;
            this.grid[pos.r][pos.c].mark = 'cross';
            moveGroup.push({ r: pos.r, c: pos.c, prevMark: oldM, newMark: 'cross' });
            this.updateCellView(pos.r, pos.c);
          }
        }
      }

      this.undoStack.push(moveGroup);
      sounds.playBark();
      this.updateCellView(r, c);
      this.saveActiveGame();
      this.validateAndCheckWin();
    } else {
      // Mark mode (cross): Overwrites empty, question mark, or dog with cross
      const prevMark = cell.mark;
      const newMark: CellMark = cell.mark === 'cross' ? 'empty' : 'cross';
      cell.mark = newMark;
      this.undoStack.push([{ r, c, prevMark, newMark }]);

      if (newMark === 'cross') {
        sounds.playPaw();
      } else {
        sounds.playErase();
      }

      this.updateCellView(r, c);
      this.saveActiveGame();
      this.validateAndCheckWin();
    }
  }

  private findDogInRow(r: number, excludeC: number): Position | null {
    for (let c = 0; c < this.currentPuzzle.size; c++) {
      if (c !== excludeC && this.grid[r][c].mark === 'dog') {
        return { r, c };
      }
    }
    return null;
  }

  private findDogInCol(excludeR: number, c: number): Position | null {
    for (let r = 0; r < this.currentPuzzle.size; r++) {
      if (r !== excludeR && this.grid[r][c].mark === 'dog') {
        return { r, c };
      }
    }
    return null;
  }

  private findDogInRegion(r: number, c: number, region: number): Position | null {
    for (let row = 0; row < this.currentPuzzle.size; row++) {
      for (let col = 0; col < this.currentPuzzle.size; col++) {
        if ((row !== r || col !== c) && this.grid[row][col].region === region && this.grid[row][col].mark === 'dog') {
          return { r: row, c: col };
        }
      }
    }
    return null;
  }

  private findAdjacentDog(r: number, c: number): Position | null {
    const size = this.currentPuzzle.size;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (this.grid[nr][nc].mark === 'dog') {
            return { r: nr, c: nc };
          }
        }
      }
    }
    return null;
  }

  private flashDeny(r: number, c: number, message: string, conflictPos?: Position) {
    const cellEl = document.getElementById(`cell-${r}-${c}`);
    if (cellEl) {
      cellEl.classList.remove('cell-deny');
      void cellEl.offsetWidth;
      cellEl.classList.add('cell-deny');
      setTimeout(() => cellEl.classList.remove('cell-deny'), 350);
    }

    if (conflictPos) {
      const conflictEl = document.getElementById(`cell-${conflictPos.r}-${conflictPos.c}`);
      if (conflictEl) {
        conflictEl.classList.remove('cell-deny');
        void conflictEl.offsetWidth;
        conflictEl.classList.add('cell-deny');
        setTimeout(() => conflictEl.classList.remove('cell-deny'), 350);
      }
    }

    this.hintBubbleTextEl.textContent = message;
    this.hintBubbleEl.classList.remove('hidden');
    if (this.hintTimeout !== null) clearTimeout(this.hintTimeout);
    this.hintTimeout = window.setTimeout(() => this.hideHint(), 3000);

    // Lose a bone (life) on mistake!
    this.loseLife();
  }

  private updateLivesView(brokenIndex?: number) {
    for (let i = 0; i < 3; i++) {
      const boneEl = document.getElementById(`bone-${i}`);
      if (!boneEl) continue;
      if (i < this.lives) {
        boneEl.classList.remove('lost', 'break');
      } else {
        boneEl.classList.add('lost');
        if (i === brokenIndex) {
          boneEl.classList.add('break');
          setTimeout(() => boneEl.classList.remove('break'), 500);
        }
      }
    }
  }

  private loseLife() {
    if (this.isFinished) return;
    this.lives = Math.max(0, this.lives - 1);
    this.updateLivesView(this.lives);
    this.saveActiveGame();

    if (this.lives <= 0) {
      // 3 mistakes -> Game Over
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.isFinished = true;
    this.stopTimer();
    this.clearActiveGame();
    sounds.playConflict();

    const gameoverModal = document.getElementById('modal-gameover')!;
    const shibaContainer = document.getElementById('gameover-shiba-container');
    if (shibaContainer) {
      shibaContainer.innerHTML = getShibaSvg(this.settings.shibaType, 'conflict');
    }

    setTimeout(() => {
      gameoverModal.classList.remove('hidden');
    }, 400);
  }


  private validateAndCheckWin() {
    const validation = validateGrid(this.grid, this.currentPuzzle);
    this.updateAllConflicts(validation.conflictingCells);
    this.updateStatus(validation.dogCount);

    if (validation.isComplete && !this.isFinished) {
      this.handleVictory();
    }
  }

  private handleVictory() {
    this.isFinished = true;
    this.stopTimer();
    sounds.playWin();


    // Calculate score
    const size = this.currentPuzzle.size;
    const baseScore = size * 400;
    const timeBonus = Math.max(0, 1200 - this.elapsedSeconds * 6);
    const score = baseScore + timeBonus;

    // Record progression
    this.completedLevels[this.currentStageIndex + 1] = {
      timeSecs: this.elapsedSeconds,
      score,
    };

    if (this.currentStageIndex + 1 >= this.unlockedLevel) {
      this.unlockedLevel = Math.min(MAX_STAGE_LEVEL, this.currentStageIndex + 2);
    }

    if (score > this.dailyBestScore) {
      this.dailyBestScore = score;
      this.dailyBestTimeSecs = this.elapsedSeconds;
    }

    this.clearActiveGame();
    this.saveProgression();

    // Earn bone points based on puzzle size (3, 4, 5, or 6 points)
    const earnedPoints = Math.max(3, Math.min(6, size - 3));

    // Simulate other competitors earning points realistically over time
    simulateRivalPoints();

    // Confetti celebration
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Show Meowdoku-style Tournament Rank-Up Screen!
    setTimeout(() => {
      this.showRankUpScreen(earnedPoints);
    }, 450);
  }

  private showRankUpScreen(earnedPoints: number) {
    const prevPoints = this.tournamentPoints;
    const rankUpData = calculateRankUp(prevPoints, earnedPoints);
    this.tournamentPoints = rankUpData.newPoints;
    this.saveProgression();

    const overlay = document.getElementById('modal-rankup')!;
    overlay.classList.remove('hidden');

    // 1. Update countdown timer until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffMs = midnight.getTime() - now.getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    const countdownEl = document.getElementById('rankup-timer-countdown');
    if (countdownEl) {
      countdownEl.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 2. Update Podium tops (Gold, Silver, Bronze) dynamically (including Champion user!)
    const goldAvatar = document.querySelector('.podium-gold .avatar-emoji');
    const goldName = document.querySelector('.podium-gold .podium-name');
    const goldScore = document.querySelector('.podium-gold .score-num');
    const silverAvatar = document.querySelector('.podium-silver .avatar-emoji');
    const silverName = document.querySelector('.podium-silver .podium-name');
    const silverScore = document.querySelector('.podium-silver .score-num');
    const bronzeAvatar = document.querySelector('.podium-bronze .avatar-emoji');
    const bronzeName = document.querySelector('.podium-bronze .podium-name');
    const bronzeScore = document.querySelector('.podium-bronze .score-num');

    if (goldAvatar && rankUpData.top3[1]) goldAvatar.textContent = rankUpData.top3[1].avatar;
    if (goldName && rankUpData.top3[1]) goldName.textContent = rankUpData.top3[1].name;
    if (goldScore && rankUpData.top3[1]) goldScore.textContent = String(rankUpData.top3[1].points);
    if (silverAvatar && rankUpData.top3[0]) silverAvatar.textContent = rankUpData.top3[0].avatar;
    if (silverName && rankUpData.top3[0]) silverName.textContent = rankUpData.top3[0].name;
    if (silverScore && rankUpData.top3[0]) silverScore.textContent = String(rankUpData.top3[0].points);
    if (bronzeAvatar && rankUpData.top3[2]) bronzeAvatar.textContent = rankUpData.top3[2].avatar;
    if (bronzeName && rankUpData.top3[2]) bronzeName.textContent = rankUpData.top3[2].name;
    if (bronzeScore && rankUpData.top3[2]) bronzeScore.textContent = String(rankUpData.top3[2].points);

    // 3. Render Cards List in initial state
    const container = document.getElementById('rankup-cards-container')!;
    container.innerHTML = '';

    rankUpData.displayList.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = `rankup-card ${entry.isUser ? 'is-user-card' : ''}`;
      card.id = `rankup-card-${idx}`;

      card.innerHTML = `
        <div class="card-rank-num" id="rank-num-${idx}">${entry.rank}</div>
        <div class="card-avatar-box" style="background: ${entry.avatarBg}">
          <span>${entry.avatar}</span>
        </div>
        <div class="card-user-name">${entry.name}</div>
        <div class="card-score-pill">
          <span class="score-bone-icon">🦴</span>
          <span class="score-num" id="card-pts-${idx}">${entry.points}</span>
        </div>
      `;
      container.appendChild(card);
    });

    // 4. Play flying bones & score increment after 450ms
    setTimeout(() => {
      this.playFlyingBones(earnedPoints, () => {
        const userPtsEl = document.getElementById(`card-pts-${rankUpData.userIndexBefore}`);
        if (userPtsEl) {
          userPtsEl.textContent = String(rankUpData.newPoints);
          userPtsEl.classList.add('bump');
          sounds.playBark();
        }

        // 5. Slide Up Animation if user actually moved up in rank
        setTimeout(() => {
          const userCard = document.getElementById('rankup-card-2');
          const rivalCard = document.getElementById('rankup-card-1');

          if (rankUpData.newRank < rankUpData.prevRank && userCard && rivalCard) {
            // Overtake animation!
            userCard.classList.add('slide-up');
            rivalCard.classList.add('slide-down');
            sounds.playPaw();

            // 6. Update Ranks & Shine after slide completes (600ms), and physically reorder DOM!
            setTimeout(() => {
              const userRankEl = document.getElementById('rank-num-2');
              const rivalRankEl = document.getElementById('rank-num-1');
              if (userRankEl && rivalRankEl) {
                userRankEl.textContent = String(rankUpData.newRank);
                rivalRankEl.textContent = String(rankUpData.prevRank);
                userRankEl.classList.add('bump');
                rivalRankEl.classList.add('bump');
              }

              // Physically reorder DOM elements to eliminate any gap or offset!
              userCard.classList.remove('slide-up');
              rivalCard.classList.remove('slide-down');
              container.insertBefore(userCard, rivalCard);

              // Confetti pop!
              confetti({
                particleCount: 60,
                spread: 60,
                origin: { y: 0.7 },
              });
            }, 600);
          } else if (userCard) {
            // 1st place defense or closing in!
            userCard.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.7)';
            sounds.playBark();
          }
        }, 550);
      });
    }, 450);

    // 7. Handle Tap to Continue
    const handleTap = () => {
      overlay.removeEventListener('click', handleTap);
      overlay.classList.add('hidden');
      // Advance to next level
      const nextIndex = Math.min(this.currentStageIndex + 1, MAX_STAGE_LEVEL - 1);
      this.startGame(nextIndex);
    };
    overlay.addEventListener('click', handleTap);
  }



  private playFlyingBones(count: number, onComplete: () => void) {
    const layer = document.getElementById('flying-bones-layer')!;
    layer.innerHTML = '';
    const targetCard = document.getElementById('rankup-card-2');
    if (!targetCard) {
      onComplete();
      return;
    }

    const rect = targetCard.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const targetX = rect.right - layerRect.left - 50;
    const targetY = rect.top - layerRect.top + 10;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const bone = document.createElement('div');
        bone.className = 'flying-bone';
        bone.textContent = '🦴';
        bone.style.left = `${layerRect.width / 2 + (i - 1) * 30}px`;
        bone.style.top = `${layerRect.height - 30}px`;
        layer.appendChild(bone);

        void bone.offsetWidth;
        bone.style.left = `${targetX}px`;
        bone.style.top = `${targetY}px`;
        bone.style.transform = 'scale(0.8) rotate(360deg)';

        setTimeout(() => {
          bone.remove();
          if (i === count - 1) {
            onComplete();
          }
        }, 650);
      }, i * 140);
    }
  }


  private updateStatus(dogCount?: number) {
    const size = this.currentPuzzle.size;
    let count = dogCount;
    if (count === undefined) {
      count = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (this.grid[r][c].mark === 'dog') count++;
        }
      }
    }
    this.dogCounterEl.textContent = `${count} / ${size}`;
  }

  public undo() {
    if (this.undoStack.length === 0 || this.isFinished) return;

    const moves = this.undoStack.pop()!;
    for (let i = moves.length - 1; i >= 0; i--) {
      const m = moves[i];
      this.grid[m.r][m.c].mark = m.prevMark;
      this.updateCellView(m.r, m.c);
    }

    sounds.playErase();
    this.saveActiveGame();
    this.validateAndCheckWin();
  }

  public showHint() {
    if (this.isFinished) return;

    if (this.hintTimeout !== null) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = null;
    }

    const currentDogs: Position[] = [];
    for (let r = 0; r < this.currentPuzzle.size; r++) {
      for (let c = 0; c < this.currentPuzzle.size; c++) {
        if (this.grid[r][c].mark === 'dog') {
          currentDogs.push({ r, c });
        }
      }
    }

    const hint = getNextHint(this.currentPuzzle, currentDogs);
    if (hint) {
      this.hintBubbleTextEl.textContent = hint.reason;
      this.hintBubbleEl.classList.remove('hidden');

      const targetEl = document.getElementById(`cell-${hint.pos.r}-${hint.pos.c}`);
      if (targetEl) {
        targetEl.style.outline = '3px solid #E78B3F';
        targetEl.style.zIndex = '10';
        setTimeout(() => {
          targetEl.style.outline = '';
          targetEl.style.zIndex = '';
        }, 3500);
      }
      sounds.playBark();
    } else {
      this.hintBubbleTextEl.textContent = '順調だワン！この調子で空いているエリアを探してみよう。';
      this.hintBubbleEl.classList.remove('hidden');
    }

    this.hintTimeout = window.setTimeout(() => {
      this.hideHint();
    }, 5000);
  }

  public hideHint() {
    if (this.hintTimeout !== null) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = null;
    }
    this.hintBubbleEl.classList.add('hidden');
  }

  public showToast(msg: string) {
    this.hintBubbleTextEl.textContent = msg;
    this.hintBubbleEl.classList.remove('hidden');
    if (this.hintTimeout !== null) clearTimeout(this.hintTimeout);
    this.hintTimeout = window.setTimeout(() => this.hideHint(), 2500);
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = window.setInterval(() => {
      this.elapsedSeconds++;
      this.timerValEl.textContent = this.formatTime(this.elapsedSeconds);
      if (this.elapsedSeconds % 4 === 0) {
        this.saveActiveGame();
      }
    }, 1000);
  }


  private stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private resetTimer() {
    this.stopTimer();
    this.elapsedSeconds = 0;
    this.timerValEl.textContent = '00:00';
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  public showLeaderboard() {
    const leaderboard = getDailyLeaderboard(this.dailyBestScore, this.dailyBestTimeSecs);
    const listEl = document.getElementById('leaderboard-list');
    const myRankEl = document.getElementById('my-rank-badge');
    const mySummaryEl = document.getElementById('my-stats-summary');
    const dateEl = document.getElementById('leaderboard-date');

    const now = new Date();
    if (dateEl) {
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    }

    const userEntry = leaderboard.find((e) => e.isUser);
    if (myRankEl) {
      myRankEl.textContent = userEntry ? `#${userEntry.rank}` : '# -';
    }
    if (mySummaryEl) {
      mySummaryEl.textContent = userEntry
        ? `スコア: ${userEntry.score} 点 (${userEntry.time})`
        : '今日のスコア: まだ未挑戦';
    }

    if (listEl) {
      listEl.innerHTML = '';
      leaderboard.forEach((e) => {
        const itemEl = document.createElement('div');
        itemEl.className = `leaderboard-item ${e.isUser ? 'is-user-rank' : ''}`;

        let rankMedal = `#${e.rank}`;
        if (e.rank === 1) rankMedal = '👑';
        else if (e.rank === 2) rankMedal = '🥈';
        else if (e.rank === 3) rankMedal = '🥉';

        itemEl.innerHTML = `
          <div class="item-left">
            <span class="item-rank rank-${e.rank}">${rankMedal}</span>
            <span class="item-avatar">${e.avatar}</span>
            <span class="item-name">${e.name}</span>
          </div>
          <div class="item-right">
            <span class="item-score">${e.score} 点</span>
            <span class="item-time">${e.time}</span>
          </div>
        `;
        listEl.appendChild(itemEl);
      });
    }

    document.getElementById('modal-leaderboard')?.classList.remove('hidden');
  }

  private bindEvents() {
    // Title Screen Actions
    document.getElementById('btn-title-play')?.addEventListener('click', () => {
      this.startGame(this.unlockedLevel - 1);
    });
    document.getElementById('btn-title-stages')?.addEventListener('click', () => {
      this.renderStageList();
      document.getElementById('modal-stages')?.classList.remove('hidden');
    });
    document.getElementById('btn-title-ranking')?.addEventListener('click', () => {
      this.showLeaderboard();
    });
    document.getElementById('btn-title-help')?.addEventListener('click', () => {
      document.getElementById('modal-help')?.classList.remove('hidden');
    });
    document.getElementById('btn-title-settings')?.addEventListener('click', () => {
      this.syncSettingsUI();
      document.getElementById('modal-settings')?.classList.remove('hidden');
    });

    // Game Top Bar Actions
    document.getElementById('btn-back-home')?.addEventListener('click', () => {
      this.showTitleScreen();
    });
    document.getElementById('btn-game-ranking')?.addEventListener('click', () => {
      this.showLeaderboard();
    });
    document.getElementById('btn-leaderboard-play')?.addEventListener('click', () => {
      document.getElementById('modal-leaderboard')?.classList.add('hidden');
      this.startGame(this.unlockedLevel - 1);
    });

    // ========================================================================
    // Unified Board Interactions:
    // PC:
    //   - Left Single Click: X mark
    //   - Left Click Drag: Continuous X mark
    //   - Left Double Click: Shiba Dog mark (🐶)
    //   - Right Click: ? mark
    // Mobile:
    //   - Single Tap: X mark
    //   - Single Tap Slide: Continuous X mark
    //   - Double Tap: Shiba Dog mark (🐶)
    //   - Long Press (~400ms): ? mark
    // ========================================================================

    this.gridBoardEl.addEventListener('pointerdown', (e) => {
      // Right click (button 2) is handled by contextmenu
      if (e.button === 2) return;

      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cellEl || cellEl.dataset.r === undefined || cellEl.dataset.c === undefined) return;

      const r = parseInt(cellEl.dataset.r, 10);
      const c = parseInt(cellEl.dataset.c, 10);

      // PC Mouse Middle Button Click -> '?' mark
      if (e.button === 1) {
        e.preventDefault();
        this.clearFocusedCell();
        this.lastTapInfo = null;
        this.handleCellClick(r, c, 'question');
        return;
      }

      this.clearFocusedCell();
      this.isPointerDown = true;
      this.isDragging = false;
      this.longPressFired = false;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownCell = { r, c };
      this.dragMoveGroup = [];
      this.visitedDragCells = new Set();

      if (e.pointerType === 'touch') {
        // Mobile / Touch: initialize potential Long-Press for '?' mark (~400ms)
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
        }

        this.longPressTimer = setTimeout(() => {
          this.longPressFired = true;
          this.longPressTimer = null;
          this.lastTapInfo = null; // Long press cancels double-tap tracking
          this.handleCellClick(r, c, 'question');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate(35);
            } catch {}
          }
        }, 400);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown || !this.pointerDownPos || !this.pointerDownCell) return;

      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);

      // Threshold to detect start of drag / slide (8px)
      if (!this.isDragging && dist > 8) {
        this.isDragging = true;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.lastTapInfo = null; // Dragging cancels double-tap

        // Apply continuous X to the starting cell (protect existing dogs)
        const startR = this.pointerDownCell.r;
        const startC = this.pointerDownCell.c;
        this.visitedDragCells.add(`${startR},${startC}`);
        const startCell = this.grid[startR]?.[startC];
        if (startCell && startCell.mark !== 'dog') {
          const prev = startCell.mark;
          if (prev !== 'cross') {
            startCell.mark = 'cross';
            this.dragMoveGroup.push({ r: startR, c: startC, prevMark: prev, newMark: 'cross' });
            sounds.playPaw();
            this.updateCellView(startR, startC);
          }
        }
      }

      // Dragging / Sliding across board -> continuous X mark
      if (this.isDragging) {
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        if (!elUnder) return;
        const cellEl = elUnder.closest('.grid-cell') as HTMLElement | null;
        if (cellEl && cellEl.dataset.r !== undefined && cellEl.dataset.c !== undefined) {
          const r = parseInt(cellEl.dataset.r, 10);
          const c = parseInt(cellEl.dataset.c, 10);
          const key = `${r},${c}`;
          if (!this.visitedDragCells.has(key)) {
            this.visitedDragCells.add(key);
            const cell = this.grid[r]?.[c];
            // Protect existing dogs from accidental overwrite during drag
            if (cell && cell.mark !== 'dog' && cell.mark !== 'cross') {
              const prev = cell.mark;
              cell.mark = 'cross';
              this.dragMoveGroup.push({ r, c, prevMark: prev, newMark: 'cross' });
              sounds.playPaw();
              this.updateCellView(r, c);
            }
          }
        }
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      // Case A: Drag / Slide completed
      if (this.isDragging) {
        this.isDragging = false;
        if (this.dragMoveGroup.length > 0) {
          this.undoStack.push(this.dragMoveGroup);
          this.dragMoveGroup = [];
          this.saveActiveGame();
          this.validateAndCheckWin();
        }
        this.pointerDownCell = null;
        this.pointerDownPos = null;
        return;
      }

      // Case B: Long-Press fired on mobile touch -> don't trigger click on release
      if (this.longPressFired) {
        this.longPressFired = false;
        this.pointerDownCell = null;
        this.pointerDownPos = null;
        return;
      }

      // Case C: Single Click/Tap vs Double Click/Tap
      if (this.pointerDownCell) {
        const { r, c } = this.pointerDownCell;
        const now = Date.now();

        // Check if this tap is within 320ms on the SAME cell -> Double Click / Double Tap!
        if (
          this.lastTapInfo &&
          this.lastTapInfo.r === r &&
          this.lastTapInfo.c === c &&
          now - this.lastTapInfo.time <= 320
        ) {
          // Double Click / Double Tap -> Place or toggle Shiba Dog (🐶)!
          const prevMark = this.lastTapInfo.prevMark;
          this.lastTapInfo = null;

          // Revert the first tap's cross action from undoStack
          if (this.undoStack.length > 0) {
            const lastAction = this.undoStack[this.undoStack.length - 1];
            if (lastAction.length === 1 && lastAction[0].r === r && lastAction[0].c === c) {
              this.undoStack.pop();
            }
          }

          // Restore state before the first tap
          this.grid[r][c].mark = prevMark;

          // Now place or toggle Shiba Dog!
          this.handleCellClick(r, c, 'dog');
        } else {
          // Single Click / Single Tap -> Place or toggle Cross (✕)!
          const prevMark = this.grid[r][c].mark;
          this.lastTapInfo = { r, c, time: now, prevMark };

          this.handleCellClick(r, c, 'cross');
        }
      }

      this.pointerDownCell = null;
      this.pointerDownPos = null;
    });

    window.addEventListener('pointercancel', () => {
      this.isPointerDown = false;
      this.isDragging = false;
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.longPressFired = false;
      this.pointerDownCell = null;
      this.pointerDownPos = null;
      this.dragMoveGroup = [];
    });

    // Right Click (PC) -> '?' Mark
    this.gridBoardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.longPressFired) {
        this.longPressFired = false;
        return;
      }

      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cellEl && cellEl.dataset.r !== undefined && cellEl.dataset.c !== undefined) {
        const r = parseInt(cellEl.dataset.r, 10);
        const c = parseInt(cellEl.dataset.c, 10);
        this.clearFocusedCell();
        this.lastTapInfo = null; // Right click cancels double-tap tracking
        this.handleCellClick(r, c, 'question');
      }
    });

    // Prevent default middle-click autoscroll behavior
    this.gridBoardEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    });

    this.gridBoardEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    });

    // Track mouse hover position for PC keyboard shortcuts
    this.gridBoardEl.addEventListener('pointerover', (e) => {
      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cellEl && cellEl.dataset.r !== undefined && cellEl.dataset.c !== undefined) {
        this.hoveredPos = {
          r: parseInt(cellEl.dataset.r, 10),
          c: parseInt(cellEl.dataset.c, 10),
        };
      }
    });

    this.gridBoardEl.addEventListener('pointerleave', () => {
      this.hoveredPos = null;
    });

    // Footer Quick Action Buttons
    const modeDogBtn = document.getElementById('mode-dog');
    const modeMarkBtn = document.getElementById('mode-mark');

    modeDogBtn?.addEventListener('click', () => {
      if (this.focusedPos) {
        this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'dog');
      } else {
        this.showToast('マスをダブルタップ（Wクリック）で柴犬🐶を配置できるワン！');
      }
    });

    modeMarkBtn?.addEventListener('click', () => {
      if (this.focusedPos) {
        this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'cross');
      } else {
        this.showToast('マスをタップまたはスライドで✕マークを配置できるワン！🐾');
      }
    });

    // Action Buttons
    document.getElementById('btn-undo')!.addEventListener('click', () => this.undo());
    document.getElementById('btn-hint')!.addEventListener('click', () => this.showHint());
    document.getElementById('btn-reset')!.addEventListener('click', () => {
      if (confirm('盤面をリセットして最初からやり直しますか？')) {
        this.clearActiveGame();
        this.initPuzzle(this.currentPuzzle);
      }
    });
    document.getElementById('btn-close-hint')!.addEventListener('click', () => this.hideHint());

    // Auto-save on window blur or unload
    window.addEventListener('beforeunload', () => {
      this.saveActiveGame();
    });
    window.addEventListener('pagehide', () => {
      this.saveActiveGame();
    });


    // Auto-mark button toggle
    document.getElementById('btn-automark')!.addEventListener('click', () => {
      this.settings.autoMark = !this.settings.autoMark;
      this.saveSettings();
    });

    // Modals open/close
    this.bindModals();
    this.setupStageModal();
    this.setupSettingsModal();

    // Victory actions
    document.getElementById('btn-win-replay')!.addEventListener('click', () => {
      document.getElementById('modal-win')!.classList.add('hidden');
      this.initPuzzle(this.currentPuzzle);
    });

    document.getElementById('btn-win-ranking')?.addEventListener('click', () => {
      document.getElementById('modal-win')!.classList.add('hidden');
      this.showLeaderboard();
    });

    document.getElementById('btn-win-next')!.addEventListener('click', () => {
      document.getElementById('modal-win')!.classList.add('hidden');
      const nextIndex = Math.min(this.currentStageIndex + 1, MAX_STAGE_LEVEL - 1);
      this.startGame(nextIndex);
    });

    // Game Over actions
    document.getElementById('btn-gameover-home')?.addEventListener('click', () => {
      document.getElementById('modal-gameover')?.classList.add('hidden');
      this.showTitleScreen();
    });

    document.getElementById('btn-gameover-retry')?.addEventListener('click', () => {
      document.getElementById('modal-gameover')?.classList.add('hidden');
      this.initPuzzle(this.currentPuzzle);
    });

    // Keyboard Navigation & Hotkeys
    window.addEventListener('keydown', (e) => {
      const targetTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(targetTag)) {
        return;
      }

      // Check if any modal is currently visible
      const activeModal = document.querySelector('.modal-backdrop:not(.hidden), .rankup-overlay:not(.hidden), .modal-overlay:not(.hidden)');
      if (activeModal) {
        if (e.key === 'Escape') {
          activeModal.classList.add('hidden');
        }
        return;
      }

      // Only active when playing on the game screen
      if (this.screenGameEl.classList.contains('hidden') || this.isFinished) {
        return;
      }

      const size = this.currentPuzzle.size;

      switch (e.key) {
        case 'ArrowUp':
        case 'KeyW':
        case 'w':
        case 'W':
          e.preventDefault();
          this.inputDevice = 'keyboard';
          if (!this.focusedPos) {
            this.setFocusedCell(0, 0);
          } else {
            this.setFocusedCell(Math.max(0, this.focusedPos.r - 1), this.focusedPos.c);
          }
          break;
        case 'ArrowDown':
        case 'KeyS':
        case 's':
        case 'S':
          e.preventDefault();
          this.inputDevice = 'keyboard';
          if (!this.focusedPos) {
            this.setFocusedCell(0, 0);
          } else {
            this.setFocusedCell(Math.min(size - 1, this.focusedPos.r + 1), this.focusedPos.c);
          }
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'a':
        case 'A':
          e.preventDefault();
          this.inputDevice = 'keyboard';
          if (!this.focusedPos) {
            this.setFocusedCell(0, 0);
          } else {
            this.setFocusedCell(this.focusedPos.r, Math.max(0, this.focusedPos.c - 1));
          }
          break;
        case 'ArrowRight':
        case 'KeyD':
        case 'd':
        case 'D':
          e.preventDefault();
          this.inputDevice = 'keyboard';
          if (!this.focusedPos) {
            this.setFocusedCell(0, 0);
          } else {
            this.setFocusedCell(this.focusedPos.r, Math.min(size - 1, this.focusedPos.c + 1));
          }
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (this.inputDevice === 'keyboard' && this.focusedPos) {
            this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'dog');
          }
          break;
        case 'x':
        case 'X':
        case 'm':
        case 'M':
          e.preventDefault();
          if (this.inputDevice === 'keyboard' && this.focusedPos) {
            this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'cross');
          }
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          {
            const targetPos =
              this.inputDevice === 'keyboard' && this.focusedPos
                ? this.focusedPos
                : (this.hoveredPos || this.focusedPos);
            if (targetPos) {
              this.handleCellClick(targetPos.r, targetPos.c, 'question');
            }
          }
          break;
        case 'z':
        case 'Z':
          if (!e.repeat) {
            e.preventDefault();
            this.undo();
          }
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          this.showHint();
          break;
        case 'Escape':
          this.showTitleScreen();
          break;
      }
    });
  }

  private isTouchDevice(): boolean {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
  }

  private showControlsModal() {
    const isTouch = this.isTouchDevice();
    const badgePc = document.getElementById('badge-device-pc');
    const badgeMobile = document.getElementById('badge-device-mobile');

    if (isTouch) {
      badgePc?.classList.add('hidden');
      badgeMobile?.classList.remove('hidden');
      this.switchControlsTab('mobile');
    } else {
      badgePc?.classList.remove('hidden');
      badgeMobile?.classList.add('hidden');
      this.switchControlsTab('pc');
    }

    document.getElementById('modal-controls')?.classList.remove('hidden');
  }

  private switchControlsTab(tab: 'pc' | 'mobile') {
    const tabPc = document.getElementById('tab-controls-pc');
    const tabMobile = document.getElementById('tab-controls-mobile');
    const secPc = document.getElementById('controls-section-pc');
    const secMobile = document.getElementById('controls-section-mobile');

    if (tab === 'mobile') {
      tabMobile?.classList.add('active');
      tabPc?.classList.remove('active');
      secMobile?.classList.remove('hidden');
      secPc?.classList.add('hidden');
    } else {
      tabPc?.classList.add('active');
      tabMobile?.classList.remove('active');
      secPc?.classList.remove('hidden');
      secMobile?.classList.add('hidden');
    }
  }

  private bindModals() {
    const openHelp = () => {
      document.getElementById('modal-help')?.classList.remove('hidden');
    };
    document.querySelector('.mini-rules-bar')?.addEventListener('click', openHelp);

    document.getElementById('btn-controls')?.addEventListener('click', () => {
      this.showControlsModal();
    });
    document.getElementById('btn-title-controls')?.addEventListener('click', () => {
      this.showControlsModal();
    });
    document.getElementById('tab-controls-pc')?.addEventListener('click', () => {
      this.switchControlsTab('pc');
    });
    document.getElementById('tab-controls-mobile')?.addEventListener('click', () => {
      this.switchControlsTab('mobile');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.syncSettingsUI();
      document.getElementById('modal-settings')?.classList.remove('hidden');
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const modalId = (e.currentTarget as HTMLElement).dataset.closeModal;
        if (modalId) {
          document.getElementById(modalId)?.classList.add('hidden');
        }
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
        }
      });
    });
  }

  private setupStageModal() {
    // Single delegated click listener on stages grid
    const gridEl = document.getElementById('stages-level-grid');
    gridEl?.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest('.level-cell') as HTMLElement | null;
      if (!cell || cell.classList.contains('locked')) return;
      const idxStr = cell.dataset.levelIndex;
      if (idxStr !== undefined) {
        const idx = parseInt(idxStr, 10);
        document.getElementById('modal-stages')?.classList.add('hidden');
        this.startGame(idx);
      }
    });

    // Jump to specific level (1 to 999,999)
    document.getElementById('btn-jump-level')?.addEventListener('click', () => {
      const input = document.getElementById('input-jump-level') as HTMLInputElement;
      const level = parseInt(input.value, 10);
      if (level >= 1 && level <= MAX_STAGE_LEVEL) {
        document.getElementById('modal-stages')!.classList.add('hidden');
        this.screenTitleEl.classList.add('hidden');
        this.screenGameEl.classList.remove('hidden');
        this.startGame(level - 1);
      } else {
        alert('1 から 999,999 までのレベル番号を入力してくださいワン！');
      }
    });

    // Random generator
    document.getElementById('btn-generate-puzzle')?.addEventListener('click', () => {
      const selectEl = document.getElementById('select-random-size') as HTMLSelectElement;
      const size = parseInt(selectEl.value, 10);
      const generated = generateUniquePuzzle(size, {
        name: `カスタム ${size}x${size}`,
      });
      document.getElementById('modal-stages')!.classList.add('hidden');
      this.screenTitleEl.classList.add('hidden');
      this.screenGameEl.classList.remove('hidden');
      this.initPuzzle(generated);
    });
  }

  private renderStageList() {
    const gridEl = document.getElementById('stages-level-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // Show up to the unlocked level + 4 previews (minimum 30 levels displayed)
    const maxDisplay = Math.min(MAX_STAGE_LEVEL, Math.max(30, this.unlockedLevel + 4));

    for (let idx = 0; idx < maxDisplay; idx++) {
      const levelNum = idx + 1;
      const isLocked = levelNum > this.unlockedLevel;
      const isCompleted = !!this.completedLevels[levelNum];
      const isCurrent = idx === this.currentStageIndex;

      const stage = getStageByLevel(levelNum);
      const cell = document.createElement('div');
      cell.className = `level-cell ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`;

      let starIcon = isCompleted ? '⭐⭐⭐' : isLocked ? '🔒' : '🐾';

      cell.innerHTML = `
        <span class="level-num">Lv.${levelNum.toLocaleString()}</span>
        <span class="level-size-tag">${stage.size}x${stage.size} (${this.getDifficultyLabel(stage.difficulty, stage.size)})</span>
        <span class="level-stars">${starIcon}</span>
      `;

      if (!isLocked) {
        cell.dataset.levelIndex = String(idx);
      }

      gridEl.appendChild(cell);
    }
  }

  private getDifficultyLabel(diff: string, size?: number): string {
    if (size === 10) return '超名人';
    switch (diff) {
      case 'beginner': return '入門';
      case 'easy': return '初級';
      case 'medium': return '中級';
      case 'hard': return '上級';
      case 'expert': return '名人';
      default: return diff;
    }
  }

  private updateAutomarkBadge() {
    if (this.automarkBadgeEl) {
      this.automarkBadgeEl.textContent = this.settings.autoMark ? 'ON' : 'OFF';
      this.automarkBadgeEl.classList.toggle('off', !this.settings.autoMark);
    }
  }

  private setupSettingsModal() {
    const shibaBtns = document.querySelectorAll('.shiba-choice-btn');
    shibaBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        shibaBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.shibaType = ((btn as HTMLElement).dataset.shiba as ShibaType) || 'aka';
        this.saveSettings();
        this.setupTitleMascot();
        this.renderBoard();
      });
    });

    const soundToggle = document.getElementById('setting-sound') as HTMLInputElement;
    soundToggle?.addEventListener('change', () => {
      this.settings.soundEnabled = soundToggle.checked;
      this.saveSettings();
    });

    const autoMarkToggle = document.getElementById('setting-automark') as HTMLInputElement;
    autoMarkToggle?.addEventListener('change', () => {
      this.settings.autoMark = autoMarkToggle.checked;
      this.saveSettings();
    });

    const resetProgressBtn = document.getElementById('btn-reset-progress');
    resetProgressBtn?.addEventListener('click', () => {
      if (confirm('すべてのクリア進捗とセーブデータを初期化しますか？')) {
        storage.resetAllProgress();
        this.unlockedLevel = 1;
        this.completedLevels = {};
        this.tournamentPoints = 0;
        document.getElementById('modal-settings')?.classList.add('hidden');
        this.showTitleScreen();
        alert('進捗データを初期化しましたワン！');
      }
    });
  }


  private syncSettingsUI() {
    const shibaBtns = document.querySelectorAll('.shiba-choice-btn');
    shibaBtns.forEach((btn) => {
      btn.classList.toggle(
        'active',
        (btn as HTMLElement).dataset.shiba === this.settings.shibaType
      );
    });

    const soundToggle = document.getElementById('setting-sound') as HTMLInputElement;
    if (soundToggle) soundToggle.checked = this.settings.soundEnabled;

    const autoMarkToggle = document.getElementById('setting-automark') as HTMLInputElement;
    if (autoMarkToggle) autoMarkToggle.checked = this.settings.autoMark;
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new InudokuGame();
});

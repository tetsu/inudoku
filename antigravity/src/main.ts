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
import { calculateRankUp, getDailyLeaderboard, PodiumEntry, simulateRivalPoints } from './logic/leaderboard';
import { storage } from './storage/storage';
import { i18n, t } from './i18n/i18n';

class InudokuGame {
  private currentPuzzle: PuzzleDefinition = getStageByLevel(1);

  private currentStageIndex: number = 0;
  private grid: CellState[][] = [];
  private undoStack: MoveAction[][] = [];
  private inputMode: 'dog' | 'mark' = 'mark';
  private focusedPos: Position | null = null;
  private hoveredPos: Position | null = null;
  private inputDevice: 'pointer' | 'keyboard' | 'gamepad' = 'pointer';

  // Gamepad Controller Support
  private isGamepadConnected: boolean = false;
  private gamepadLoopId: number | null = null;
  private prevGamepadButtons: boolean[] = [];
  private gamepadDirActive: string = '';
  private gamepadNextRepeatTime: number = 0;
  private titleFocusIdx: number = 0;
  private stageFocusIdx: number = 0;
  private settingsRowIdx: number = 0;
  private dialogFocusBtn: 'confirm' | 'cancel' = 'confirm';
  private leaderboardFocusBtn: 'play' | 'close' = 'play';
  private winModalFocusIdx: number = 2;
  private gameOverFocusIdx: number = 1;

  // Pointer, Drag, Double-Tap & Long-Press tracking
  private isPointerDown: boolean = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownCell: Position | null = null;
  private isDragging: boolean = false;
  private dragMode: 'cross' | 'erase' | null = null;
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
  private hintCount: number = 5;
  private pendingDailyReward: boolean = false;

  // Settings
  private settings: GameSettings = {
    autoMark: true,
    soundEnabled: true,
    vibrationEnabled: true,
    shibaType: 'aka',
    highContrast: false,
    language: 'auto',
  };

  // Tutorial / Help Modal
  private currentTutorialSlide: number = 0;
  private tutorialModalBound: boolean = false;

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
  private automarkBadgeEl: HTMLElement | null = null;
  private dialogResolve: ((value: boolean) => void) | null = null;
  private iosHapticInput: HTMLInputElement | null = null;

  constructor() {
    this.loadSavedData();
    this.initDOMElements();
    this.initIosHaptics();
    this.bindEvents();
    this.renderTitleScreen();
    this.setupTitleMascot();
    this.updateHintBadge();
    this.checkAndShowDailyReward();
    this.initGamepadSupport();
  }

  private loadSavedData() {
    this.settings = storage.getSettings(this.settings);
    sounds.setEnabled(this.settings.soundEnabled);
    i18n.setSetting(this.settings.language || 'auto');
    i18n.applyTranslations();

    this.unlockedLevel = storage.getUnlockedLevel();
    this.completedLevels = storage.getCompletedLevels();

    this.hintCount = storage.getHintCount();
    this.checkDailySettlement();

    const daily = storage.getDailyScore();
    if (daily) {
      this.dailyBestScore = daily.score;
      this.dailyBestTimeSecs = daily.timeSecs;
    }

    this.tournamentPoints = storage.getDailyTournamentPoints();
  }

  private checkDailySettlement() {
    const today = storage.getLocalDateString(new Date());
    const lastSettlement = storage.getLastSettlementDate();
    const lastActive = storage.getLastActiveDate();

    if (!lastSettlement) {
      // First launch ever
      storage.setLastSettlementDate(today);
      storage.setLastActiveDate(today);
      return;
    }

    if (lastSettlement !== today) {
      // Date has changed! Check if player reached 1st place on the previous active date
      const targetDate = lastActive || '';
      if (targetDate && storage.hasDailyFirstPlace(targetDate) && !storage.hasDailyRewardClaimed(today)) {
        this.pendingDailyReward = true;
      }

      // Settle and record today as new settlement date & active date
      storage.setLastSettlementDate(today);
      storage.setLastActiveDate(today);
    } else {
      // Same day, check if still pending and unclaimed
      const prevDate = lastActive && lastActive !== today ? lastActive : '';
      if (prevDate && storage.hasDailyFirstPlace(prevDate) && !storage.hasDailyRewardClaimed(today)) {
        this.pendingDailyReward = true;
      }
      storage.setLastActiveDate(today);
    }
  }

  private checkAndShowDailyReward() {
    const today = storage.getLocalDateString(new Date());
    if (this.pendingDailyReward && !storage.hasDailyRewardClaimed(today)) {
      this.pendingDailyReward = false;
      const modal = document.getElementById('modal-daily-reward');
      if (modal) {
        setTimeout(() => {
          modal.classList.remove('hidden');
          sounds.playBark();
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { y: 0.6 },
          });
        }, 600);
      }
    }
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

  public setFocusedCell(r: number, c: number, device: 'keyboard' | 'gamepad' = 'keyboard') {
    this.inputDevice = device;
    if (device === 'gamepad') {
      document.body.classList.add('gamepad-active');
    }
    // Never show keyboard focus box on touch/mobile devices unless gamepad is actively used
    if (device !== 'gamepad' && window.matchMedia('(pointer: coarse), (hover: none)').matches) {
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
      document.body.classList.remove('gamepad-active');
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
    this.automarkBadgeEl = document.getElementById('automark-badge');

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
        playBtnText.innerHTML = t('title.btn.resume', { level: targetLvl });
      } else {
        playBtnText.innerHTML = t('title.btn.play', { level: targetLvl });
      }
    }

    const todayDateEl = document.getElementById('title-today-date');
    if (todayDateEl) {
      const now = new Date();
      if (i18n.getResolvedLang() === 'ja') {
        todayDateEl.textContent = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
      } else {
        todayDateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    const progressEl = document.getElementById('title-progress-text');
    if (progressEl) {
      const completedCount = Object.keys(this.completedLevels).length;
      progressEl.textContent = t('title.footer.cleared', { completed: completedCount, total: 15 });
    }
  }

  public showTitleScreen() {
    this.stopTimer();
    this.saveActiveGame();
    this.screenGameEl.classList.add('hidden');
    this.screenTitleEl.classList.remove('hidden');
    this.renderTitleScreen();
    this.setupTitleMascot();
    this.updateHintBadge();
    this.checkAndShowDailyReward();
    this.titleFocusIdx = 0;
    this.clearMenuFocus();
    document.getElementById('btn-title-play')?.classList.add('menu-focused');
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
    this.updateHintBadge();

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

    // 初回プレイヤーの場合は遊び方ルールを自動表示！
    if (this.isFirstTimeUser()) {
      this.showHelpModal(true);
    }
  }

  private isFirstTimeUser(): boolean {
    if (storage.hasSeenRules()) return false;
    const completed = storage.getCompletedLevels();
    const hasCompletedAny = Object.keys(completed).length > 0;
    const isLevel1 = storage.getUnlockedLevel() === 1;
    const hasActiveGame = !!storage.getActiveGame();
    return !hasCompletedAny && isLevel1 && !hasActiveGame;
  }

  public showHelpModal(isInitial: boolean = false) {
    const helpModal = document.getElementById('modal-help');
    if (!helpModal) return;
    this.stopTimer();
    this.setupTutorialModal();
    this.renderTutorialVisuals();
    this.switchTutorialSlide(0, false);
    helpModal.classList.remove('hidden');
    if (isInitial) {
      storage.setHasSeenRules(true);
    }
  }

  public setupTutorialModal() {
    if (this.tutorialModalBound) return;
    this.tutorialModalBound = true;

    document.querySelectorAll('[data-tutorial-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.tutorialTab);
        if (!isNaN(idx)) {
          this.switchTutorialSlide(idx);
        }
      });
    });

    document.querySelectorAll('[data-tutorial-dot]').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.tutorialDot);
        if (!isNaN(idx)) {
          this.switchTutorialSlide(idx);
        }
      });
    });

    document.getElementById('btn-tutorial-prev')?.addEventListener('click', () => {
      if (this.currentTutorialSlide > 0) {
        this.switchTutorialSlide(this.currentTutorialSlide - 1);
      }
    });

    document.getElementById('btn-tutorial-next')?.addEventListener('click', () => {
      if (this.currentTutorialSlide < 3) {
        this.switchTutorialSlide(this.currentTutorialSlide + 1);
      } else {
        document.getElementById('modal-help')?.classList.add('hidden');
        storage.setHasSeenRules(true);
        if (!this.screenGameEl.classList.contains('hidden') && !this.isFinished) {
          this.startTimer();
        }
      }
    });
  }

  public switchTutorialSlide(idx: number, playSound: boolean = true) {
    this.currentTutorialSlide = Math.max(0, Math.min(3, idx));
    if (playSound) {
      sounds.playPaw();
    }

    document.querySelectorAll('.tutorial-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === this.currentTutorialSlide);
    });

    document.querySelectorAll('.tutorial-slide').forEach((slide, i) => {
      slide.classList.toggle('active', i === this.currentTutorialSlide);
    });

    document.querySelectorAll('.tutorial-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentTutorialSlide);
    });

    const btnPrev = document.getElementById('btn-tutorial-prev');
    const btnNext = document.getElementById('btn-tutorial-next');
    if (btnPrev) {
      btnPrev.style.display = this.currentTutorialSlide === 0 ? 'none' : 'inline-flex';
    }
    if (btnNext) {
      btnNext.textContent = this.currentTutorialSlide === 3 ? t('rule.btn.start') : t('rule.btn.next');
    }
  }

  public renderTutorialVisuals() {
    // 1. Board Area (3x3 with 2 color zones)
    const boardArea = document.getElementById('tutorial-board-area');
    if (boardArea) {
      boardArea.innerHTML = '';
      const colorA = REGION_COLORS[0]; // Meadow green
      const colorB = REGION_COLORS[1]; // Sky cyan
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement('div');
          cell.className = 'mini-cell';
          const isRegionA = (r === 0 && c === 0) || (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 2 && c === 0);
          cell.style.setProperty('--cell-bg', isRegionA ? colorA : colorB);

          if (r === 0 && c === 0) {
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'normal');
          } else if (r === 2 && c === 2) {
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'normal');
          } else {
            cell.innerHTML = getCrossSvg('#FFFFFF');
          }
          boardArea.appendChild(cell);
        }
      }
    }

    // 2. Board Lines (4x4 with 4 regions and row/col highlight)
    const boardLine = document.getElementById('tutorial-board-line');
    if (boardLine) {
      boardLine.innerHTML = '';
      const colors = [REGION_COLORS[0], REGION_COLORS[1], REGION_COLORS[3], REGION_COLORS[2]];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = document.createElement('div');
          cell.className = 'mini-cell';
          const quadIndex = (r < 2 ? 0 : 2) + (c < 2 ? 0 : 1);
          cell.style.setProperty('--cell-bg', colors[quadIndex]);

          const isDog1 = r === 1 && c === 1;
          const isDog2 = r === 3 && c === 3;
          const isLine1 = r === 1 || c === 1;
          const isLine2 = r === 3 || c === 3;

          if (isDog1 || isDog2) {
            cell.classList.add('cell-line-placed');
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'normal');
          } else if (isLine1 || isLine2) {
            cell.classList.add('cell-line-highlight');
            cell.innerHTML = getCrossSvg('#FFFFFF');
          }
          boardLine.appendChild(cell);
        }
      }
    }

    // 3. Board NG (3x3 conflict)
    const boardNg = document.getElementById('tutorial-board-ng');
    if (boardNg) {
      boardNg.innerHTML = '';
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement('div');
          cell.className = 'mini-cell';
          if ((r === 0 && c === 0) || (r === 1 && c === 1)) {
            cell.classList.add('cell-conflict');
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'conflict');
          } else {
            cell.style.setProperty('--cell-bg', '#FEE2E2');
            if (r === 0 && c === 1) {
              cell.innerHTML = '<span style="font-size:1.1rem;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2));">💢</span>';
            }
          }
          boardNg.appendChild(cell);
        }
      }
    }

    // 3. Board OK (3x3 safe)
    const boardOk = document.getElementById('tutorial-board-ok');
    if (boardOk) {
      boardOk.innerHTML = '';
      const colorA = REGION_COLORS[0]; // Meadow green
      const colorB = REGION_COLORS[1]; // Sky cyan
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement('div');
          cell.className = 'mini-cell';
          const isAreaA = r < 2 && c < 2;
          cell.style.setProperty('--cell-bg', isAreaA ? colorA : colorB);

          if (r === 0 && c === 0) {
            cell.classList.add('cell-safe');
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'happy');
          } else if (r === 2 && c === 2) {
            cell.classList.add('cell-safe');
            cell.innerHTML = getShibaSvg(this.settings.shibaType, 'happy');
          } else {
            cell.innerHTML = getCrossSvg('#FFFFFF');
          }
          boardOk.appendChild(cell);
        }
      }
    }

    // 4. Action previews in Slide 3
    document.querySelectorAll('.mini-cross-preview').forEach((el) => {
      el.innerHTML = getCrossSvg('#FFFFFF');
    });
    document.querySelectorAll('.mini-shiba-preview').forEach((el) => {
      el.innerHTML = getShibaSvg(this.settings.shibaType, 'normal');
    });
    document.querySelectorAll('.mini-question-preview').forEach((el) => {
      el.innerHTML = getQuestionSvg('#FFFFFF');
    });
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
    this.dragMode = null;

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

    if ((this.inputDevice === 'keyboard' || this.inputDevice === 'gamepad') && this.focusedPos) {
      this.setFocusedCell(this.focusedPos.r, this.focusedPos.c, this.inputDevice);
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

  private initIosHaptics() {
    if (typeof document === 'undefined') return;
    try {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.style.position = 'fixed';
        input.style.top = '-9999px';
        input.style.left = '-9999px';
        input.style.opacity = '0.001';
        input.style.pointerEvents = 'none';
        input.tabIndex = -1;
        document.body.appendChild(input);
        this.iosHapticInput = input;
      }
    } catch {}
  }

  private triggerIosHaptic() {
    if (this.iosHapticInput) {
      try {
        this.iosHapticInput.click();
      } catch {}
    }
  }

  private vibrateLight(durationOrPattern: number | number[] = 35) {
    if (!this.settings.vibrationEnabled) return;

    this.vibrateGamepad(durationOrPattern);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        if (Array.isArray(durationOrPattern)) {
          navigator.vibrate(durationOrPattern);
        } else {
          // On mobile Chrome (Android), vibration motors require at least ~30ms to ramp up physically
          const duration = Math.max(30, durationOrPattern);
          navigator.vibrate([duration]);
        }
      } catch {}
      return;
    }

    // iOS WebKit Taptic Engine fallback via switch control
    this.triggerIosHaptic();
  }

  private vibrateGamepad(durationOrPattern: number | number[] = 35) {
    if (!this.settings.vibrationEnabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const duration = Array.isArray(durationOrPattern) ? (durationOrPattern[0] || 40) : durationOrPattern;
    try {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        const actuator = (gp as any).vibrationActuator;
        if (actuator && typeof actuator.playEffect === 'function') {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: Math.max(30, Math.min(duration, 200)),
            weakMagnitude: 0.5,
            strongMagnitude: 0.3,
          }).catch(() => {});
        } else if ((gp as any).hapticActuators && (gp as any).hapticActuators.length > 0) {
          (gp as any).hapticActuators[0].pulse(0.6, duration).catch(() => {});
        }
      }
    } catch {}
  }

  private eraseCell(r: number, c: number) {
    if (this.isFinished) return;
    const cell = this.grid[r][c];
    if (cell.mark === 'empty') return;
    const prevMark = cell.mark;
    cell.mark = 'empty';
    this.undoStack.push([{ r, c, prevMark, newMark: 'empty' }]);
    sounds.playErase();
    this.vibrateLight(25);
    this.updateCellView(r, c);
    this.saveActiveGame();
    this.validateAndCheckWin();
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
        this.vibrateLight(35);
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
        this.flashDeny(r, c, t('msg.deny.row'), sameRowDog);
        sounds.playConflict();
        return;
      }

      const sameColDog = this.findDogInCol(r, c);
      if (sameColDog) {
        this.flashDeny(r, c, t('msg.deny.col'), sameColDog);
        sounds.playConflict();
        return;
      }

      const sameRegionDog = this.findDogInRegion(r, c, cell.region);
      if (sameRegionDog) {
        this.flashDeny(r, c, t('msg.deny.region'), sameRegionDog);
        sounds.playConflict();
        return;
      }

      const adjacentDog = this.findAdjacentDog(r, c);
      if (adjacentDog) {
        this.flashDeny(r, c, t('msg.deny.adjacent'), adjacentDog);
        sounds.playConflict();
        return;
      }

      // Check if (r, c) is the correct placement for the puzzle
      if (this.currentPuzzle.solution && this.currentPuzzle.solution.length > 0) {
        const isSolutionPosition = this.currentPuzzle.solution.some(
          (s) => s.r === r && s.c === c
        );
        if (!isSolutionPosition) {
          this.flashDeny(r, c, t('msg.deny.solution'));
          sounds.playConflict();
          cell.mark = 'cross';
          this.vibrateLight([45, 30, 45]);
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
      this.vibrateLight(50);
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
        this.vibrateLight(35);
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

    const today = storage.getLocalDateString(new Date());
    const wasAlreadyFirstPlaceToday = storage.hasDailyFirstPlace(today);

    if (rankUpData.newRank === 1) {
      storage.recordDailyFirstPlace(today);
    }

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

    const updatePodiumSlot = (
      avatarEl: Element | null,
      nameEl: Element | null,
      scoreEl: Element | null,
      entry?: PodiumEntry
    ) => {
      if (!avatarEl || !nameEl || !scoreEl || !entry) return;
      if (entry.isUser) {
        avatarEl.innerHTML = `<div class="podium-shiba-svg-wrap">${getShibaSvg(this.settings.shibaType, 'happy')}</div>`;
      } else {
        avatarEl.textContent = entry.avatar;
      }
      nameEl.textContent = entry.name;
      scoreEl.textContent = String(entry.points);
    };

    updatePodiumSlot(silverAvatar, silverName, silverScore, rankUpData.top3[0]);
    updatePodiumSlot(goldAvatar, goldName, goldScore, rankUpData.top3[1]);
    updatePodiumSlot(bronzeAvatar, bronzeName, bronzeScore, rankUpData.top3[2]);

    // 3. Render Cards List in initial state
    const container = document.getElementById('rankup-cards-container')!;
    container.innerHTML = '';

    rankUpData.displayList.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = `rankup-card ${entry.isUser ? 'is-user-card' : ''}`;
      card.id = `rankup-card-${idx}`;

      const avatarContent = entry.isUser
        ? `<div class="shiba-avatar-svg-wrap">${getShibaSvg(this.settings.shibaType, 'happy')}</div>`
        : `<span>${entry.avatar}</span>`;

      card.innerHTML = `
        <div class="card-rank-num" id="rank-num-${idx}">${entry.rank}</div>
        <div class="card-avatar-box ${entry.isUser ? 'is-user-avatar' : ''}" style="background: ${entry.avatarBg}">
          ${avatarContent}
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

              // Only show first-place toast if user reached 1st place for the first time today!
              if (rankUpData.newRank === 1 && !wasAlreadyFirstPlaceToday) {
                this.showToast(t('msg.rank.firstPlaceReached'));
              }
            }, 600);
          } else if (userCard) {
            // 1st place defense or closing in!
            userCard.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.7)';
            sounds.playBark();
            // Do not show firstPlaceReached toast when already defending 1st place
          }
        }, 550);
      });
    }, 450);

    // 7. Handle Tap or Key (Enter / Space) to Continue
    const handleContinue = () => {
      overlay.removeEventListener('click', handleContinue);
      window.removeEventListener('keydown', handleKeyContinue);
      overlay.classList.add('hidden');
      // Advance to next level
      const nextIndex = Math.min(this.currentStageIndex + 1, MAX_STAGE_LEVEL - 1);
      this.startGame(nextIndex);
    };

    const handleKeyContinue = (e: KeyboardEvent) => {
      if (overlay.classList.contains('hidden')) return;
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleContinue();
      }
    };

    overlay.addEventListener('click', handleContinue);
    window.addEventListener('keydown', handleKeyContinue);
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

    if (this.hintCount <= 0) {
      this.showToast(t('msg.hint.empty'));
      sounds.playConflict();
      return;
    }

    if (this.hintTimeout !== null) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = null;
    }

    // Decrement hint count and persist
    this.hintCount--;
    storage.saveHintCount(this.hintCount);
    this.updateHintBadge();

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
      if (hint.reasonKey) {
        if (hint.reasonKey === 'msg.hint.place' && hint.reasonParams) {
          const region = t('msg.hint.regionName', { num: hint.reasonParams.regionIndex });
          this.hintBubbleTextEl.textContent = t(hint.reasonKey, { row: hint.reasonParams.row, region });
        } else {
          this.hintBubbleTextEl.textContent = t(hint.reasonKey);
        }
      } else {
        this.hintBubbleTextEl.textContent = hint.reason;
      }
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
      this.hintBubbleTextEl.textContent = t('msg.hint.smooth');
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

  public updateHintBadge() {
    const badge = document.getElementById('hint-count-badge');
    if (badge) {
      badge.textContent = this.hintCount.toString();
      if (this.hintCount === 0) {
        badge.style.backgroundColor = '#9CA3AF';
      } else {
        badge.style.backgroundColor = '';
      }
    }
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
      if (i18n.getResolvedLang() === 'ja') {
        dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      } else {
        dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    const userEntry = leaderboard.find((e) => e.isUser);
    if (myRankEl) {
      myRankEl.textContent = userEntry ? `#${userEntry.rank}` : '# -';
    }
    if (mySummaryEl) {
      if (i18n.getResolvedLang() === 'ja') {
        mySummaryEl.textContent = userEntry
          ? `スコア: ${userEntry.score} 点 (${userEntry.time})`
          : '今日のスコア: まだ未挑戦';
      } else {
        mySummaryEl.textContent = userEntry
          ? `Score: ${userEntry.score} pts (${userEntry.time})`
          : "Today's score: Not played yet";
      }
    }

    const userAvatarEl = document.getElementById('my-user-shiba-avatar');
    if (userAvatarEl) {
      userAvatarEl.innerHTML = getShibaSvg(this.settings.shibaType, 'happy');
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

        const avatarHtml = e.isUser
          ? `<span class="item-avatar is-user-avatar">${getShibaSvg(this.settings.shibaType, 'happy')}</span>`
          : `<span class="item-avatar">${e.avatar}</span>`;

        itemEl.innerHTML = `
          <div class="item-left">
            <span class="item-rank rank-${e.rank}">${rankMedal}</span>
            ${avatarHtml}
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
      this.stageFocusIdx = Math.min(this.unlockedLevel - 1, MAX_STAGE_LEVEL - 1);
      const cells = Array.from(document.querySelectorAll('#modal-stages .level-cell')) as HTMLElement[];
      cells.forEach((c, idx) => {
        c.classList.toggle('menu-focused', idx === this.stageFocusIdx);
        if (idx === this.stageFocusIdx) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
    document.getElementById('btn-title-ranking')?.addEventListener('click', () => {
      this.leaderboardFocusBtn = 'play';
      this.showLeaderboard();
      document.getElementById('btn-leaderboard-play')?.classList.add('menu-focused');
    });
    document.getElementById('btn-title-help')?.addEventListener('click', () => {
      this.showHelpModal();
    });
    document.getElementById('btn-title-settings')?.addEventListener('click', () => {
      this.syncSettingsUI();
      document.getElementById('modal-settings')?.classList.remove('hidden');
      this.settingsRowIdx = 0;
      const items = Array.from(document.querySelectorAll('#modal-settings .setting-item')) as HTMLElement[];
      items.forEach((item, idx) => {
        item.classList.toggle('menu-focused', idx === 0);
      });
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
    //   - Left Click Drag (from empty/?): Continuous X mark
    //   - Left Click Drag (from X mark): Erase X mark only
    //   - Left Double Click: Shiba Dog mark (🐶)
    //   - Right Click / Middle Click: ? mark
    // Mobile:
    //   - Single Tap: X mark
    //   - Single Tap Slide (from empty/?): Continuous X mark
    //   - Single Tap Slide (from X mark): Erase X mark only
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
      this.dragMode = null;
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
          this.vibrateLight(45);
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

        const startR = this.pointerDownCell.r;
        const startC = this.pointerDownCell.c;
        this.visitedDragCells.add(`${startR},${startC}`);
        const startCell = this.grid[startR]?.[startC];

        if (startCell) {
          if (startCell.mark === 'cross') {
            // Xマークからドラッグ開始 -> Xマーク消去モード (erase)
            this.dragMode = 'erase';
            startCell.mark = 'empty';
            this.dragMoveGroup.push({ r: startR, c: startC, prevMark: 'cross', newMark: 'empty' });
            sounds.playErase();
            this.updateCellView(startR, startC);
          } else if (startCell.mark !== 'dog') {
            // 空マスや?マークからドラッグ開始 -> 連続Xマークモード (cross)
            this.dragMode = 'cross';
            const prev = startCell.mark;
            startCell.mark = 'cross';
            this.dragMoveGroup.push({ r: startR, c: startC, prevMark: prev, newMark: 'cross' });
            sounds.playPaw();
            this.vibrateLight(30);
            this.updateCellView(startR, startC);
          } else {
            // 犬からドラッグ開始した場合は誤操作防止のため何もしない
            this.dragMode = null;
          }
        }
      }

      // Dragging / Sliding across board
      if (this.isDragging && this.dragMode) {
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
            if (cell) {
              if (this.dragMode === 'erase') {
                // Xマークのマスのみマークを消す！
                if (cell.mark === 'cross') {
                  const prev = cell.mark;
                  cell.mark = 'empty';
                  this.dragMoveGroup.push({ r, c, prevMark: prev, newMark: 'empty' });
                  sounds.playErase();
                  this.updateCellView(r, c);
                }
              } else if (this.dragMode === 'cross') {
                // 連続Xマーク（既存の犬は保護）
                if (cell.mark !== 'dog' && cell.mark !== 'cross') {
                  const prev = cell.mark;
                  cell.mark = 'cross';
                  this.dragMoveGroup.push({ r, c, prevMark: prev, newMark: 'cross' });
                  sounds.playPaw();
                  this.vibrateLight(25);
                  this.updateCellView(r, c);
                }
              }
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
        this.dragMode = null;
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
      this.dragMode = null;
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

    // Action Buttons (Undo in sub-bar, Hint in footer, Reset in sub-bar)
    document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-hint')?.addEventListener('click', () => this.showHint());
    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      const ok = await this.showConfirm({
        title: t('dialog.title.confirm'),
        message: t('msg.confirm.resetBoard'),
        confirmText: t('game.btn.reset'),
        cancelText: t('dialog.btn.cancel'),
        icon: '🔄',
        isDanger: true,
      });
      if (ok) {
        this.clearActiveGame();
        this.initPuzzle(this.currentPuzzle);
      }
    });
    document.getElementById('btn-close-hint')?.addEventListener('click', () => this.hideHint());

    // Auto-save on window blur or unload
    window.addEventListener('beforeunload', () => {
      this.saveActiveGame();
    });
    window.addEventListener('pagehide', () => {
      this.saveActiveGame();
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
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      const up = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
      const down = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
      const left = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
      const right = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
      const isAction = e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.code === 'Enter';
      const isCancel = e.key === 'Escape';
      const isTab = e.key === 'Tab';

      // 1. Rank-Up Overlay (Highest priority modal screen!)
      const rankUp = document.getElementById('modal-rankup');
      if (rankUp && !rankUp.classList.contains('hidden')) {
        e.preventDefault();
        this.handleRankUpScreen();
        return;
      }

      // 2. Check if any modal is currently visible
      const activeModal = document.querySelector('.modal-backdrop:not(.hidden), .modal-overlay:not(.hidden)') as HTMLElement | null;
      if (activeModal) {
        if (activeModal.id === 'modal-dialog') {
          if (left || right || up || down || isAction || isCancel || isTab) {
            e.preventDefault();
            this.handleCustomDialogNav(left || (isTab && e.shiftKey), right || (isTab && !e.shiftKey), isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-stages') {
          if (up || down || left || right || isAction || isCancel) {
            e.preventDefault();
            this.handleStagesModalNav(up, down, left, right, isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-settings') {
          if (up || down || left || right || isAction || isCancel) {
            e.preventDefault();
            this.handleSettingsModalNav(up, down, left, right, isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-leaderboard') {
          if (up || down || left || right || isAction || isCancel || isTab) {
            e.preventDefault();
            this.handleLeaderboardModalNav(up || left, down || right || isTab, isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-help') {
          if (left || right || up || down || isAction || isCancel) {
            e.preventDefault();
            this.handleTutorialModalNav(left || up, right || down, isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-controls') {
          if (left || right || isAction || isCancel || isTab) {
            e.preventDefault();
            this.handleControlsModalNav(left || (isTab && e.shiftKey), right || (isTab && !e.shiftKey), isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-win') {
          if (left || right || isAction || isCancel || isTab) {
            e.preventDefault();
            this.handleWinModalNav(left || (isTab && e.shiftKey), right || (isTab && !e.shiftKey), isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-gameover') {
          if (left || right || isAction || isCancel || isTab) {
            e.preventDefault();
            this.handleGameOverModalNav(left || (isTab && e.shiftKey), right || (isTab && !e.shiftKey), isAction, isCancel);
          }
          return;
        }
        if (activeModal.id === 'modal-daily-reward') {
          if (isAction || isCancel) {
            e.preventDefault();
            this.handleDailyRewardModalNav(isAction, isCancel);
          }
          return;
        }
        if (isCancel) {
          e.preventDefault();
          activeModal.classList.add('hidden');
          this.clearMenuFocus();
          return;
        }
        return;
      }

      // 3. Title Screen Navigation
      if (!this.screenTitleEl.classList.contains('hidden')) {
        if (up || down || left || right || isAction || isTab) {
          e.preventDefault();
          this.handleTitleScreenNav(
            up || (isTab && e.shiftKey),
            down || (isTab && !e.shiftKey),
            left,
            right,
            isAction,
            false
          );
        }
        return;
      }

      // 4. Gameplay Screen Active
      if (this.screenGameEl.classList.contains('hidden') || this.isFinished) {
        return;
      }

      const size = this.currentPuzzle.size;

      // In-game Grid Navigation (Arrows & WASD)
      if (up || down || left || right) {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        if (!this.focusedPos) {
          this.setFocusedCell(0, 0, 'keyboard');
        } else if (up) {
          this.setFocusedCell(Math.max(0, this.focusedPos.r - 1), this.focusedPos.c, 'keyboard');
        } else if (down) {
          this.setFocusedCell(Math.min(size - 1, this.focusedPos.r + 1), this.focusedPos.c, 'keyboard');
        } else if (left) {
          this.setFocusedCell(this.focusedPos.r, Math.max(0, this.focusedPos.c - 1), 'keyboard');
        } else if (right) {
          this.setFocusedCell(this.focusedPos.r, Math.min(size - 1, this.focusedPos.c + 1), 'keyboard');
        }
        return;
      }

      // Grid Tab navigation
      if (isTab) {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        if (!this.focusedPos) {
          this.setFocusedCell(0, 0, 'keyboard');
        } else {
          let nextC = this.focusedPos.c + (e.shiftKey ? -1 : 1);
          let nextR = this.focusedPos.r;
          if (nextC >= size) {
            nextC = 0;
            nextR = (nextR + 1) % size;
          } else if (nextC < 0) {
            nextC = size - 1;
            nextR = (nextR - 1 + size) % size;
          }
          this.setFocusedCell(nextR, nextC, 'keyboard');
        }
        return;
      }

      // Space / Enter: Place or Toggle Dog (🐶)
      if (isAction) {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        if (this.focusedPos) {
          this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'dog');
        }
        return;
      }

      // X / M: Place or Toggle Cross (✕)
      if (e.key === 'x' || e.key === 'X' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        if (this.focusedPos) {
          this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'cross');
        }
        return;
      }

      // N: Place or Toggle Question Mark (？)
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        const targetPos = this.focusedPos || this.hoveredPos;
        if (targetPos) {
          this.handleCellClick(targetPos.r, targetPos.c, 'question');
        }
        return;
      }

      // Backspace / Delete / E / 0: Erase Cell
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'e' ||
        e.key === 'E' ||
        e.key === '0'
      ) {
        e.preventDefault();
        this.inputDevice = 'keyboard';
        if (this.focusedPos) {
          this.eraseCell(this.focusedPos.r, this.focusedPos.c);
        }
        return;
      }

      // Z / U: Undo
      if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') {
        if (!e.repeat) {
          e.preventDefault();
          this.undo();
        }
        return;
      }

      // H: Hint
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.showHint();
        return;
      }

      // R: Restart Stage
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        document.getElementById('btn-reset')?.click();
        return;
      }

      // O: Options / Settings Modal
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        this.syncSettingsUI();
        document.getElementById('modal-settings')?.classList.remove('hidden');
        return;
      }

      // C / ?: Controls Guide Modal
      if (e.key === 'c' || e.key === 'C' || e.key === '?') {
        e.preventDefault();
        this.showControlsModal();
        return;
      }

      // Escape: Return to Title Screen
      if (e.key === 'Escape') {
        e.preventDefault();
        this.showTitleScreen();
        return;
      }
    });
  }

  private isTouchDevice(): boolean {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
  }

  private showControlsModal() {
    const isTouch = this.isTouchDevice();
    const isGamepad = this.isGamepadConnected || this.inputDevice === 'gamepad';
    const badgePc = document.getElementById('badge-device-pc');
    const badgeMobile = document.getElementById('badge-device-mobile');
    const badgeGamepad = document.getElementById('badge-device-gamepad');

    badgePc?.classList.add('hidden');
    badgeMobile?.classList.add('hidden');
    badgeGamepad?.classList.add('hidden');

    if (isGamepad) {
      badgeGamepad?.classList.remove('hidden');
      this.switchControlsTab('gamepad');
    } else if (isTouch) {
      badgeMobile?.classList.remove('hidden');
      this.switchControlsTab('mobile');
    } else {
      badgePc?.classList.remove('hidden');
      this.switchControlsTab('pc');
    }

    document.getElementById('modal-controls')?.classList.remove('hidden');
  }

  private switchControlsTab(tab: 'pc' | 'mobile' | 'gamepad') {
    const tabPc = document.getElementById('tab-controls-pc');
    const tabMobile = document.getElementById('tab-controls-mobile');
    const tabGamepad = document.getElementById('tab-controls-gamepad');
    const secPc = document.getElementById('controls-section-pc');
    const secMobile = document.getElementById('controls-section-mobile');
    const secGamepad = document.getElementById('controls-section-gamepad');

    tabPc?.classList.toggle('active', tab === 'pc');
    tabMobile?.classList.toggle('active', tab === 'mobile');
    tabGamepad?.classList.toggle('active', tab === 'gamepad');

    secPc?.classList.toggle('hidden', tab !== 'pc');
    secMobile?.classList.toggle('hidden', tab !== 'mobile');
    secGamepad?.classList.toggle('hidden', tab !== 'gamepad');
  }

  private bindModals() {
    this.setupTutorialModal();
    const openHelp = () => {
      this.showHelpModal();
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
    document.getElementById('tab-controls-gamepad')?.addEventListener('click', () => {
      this.switchControlsTab('gamepad');
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
          if (modalId === 'modal-help') {
            storage.setHasSeenRules(true);
            if (!this.screenGameEl.classList.contains('hidden') && !this.isFinished) {
              this.startTimer();
            }
          }
          if (modalId === 'modal-daily-reward') {
            const today = storage.getLocalDateString(new Date());
            if (!storage.hasDailyRewardClaimed(today)) {
              storage.setDailyRewardClaimed(today, true);
              this.hintCount += 5;
              storage.saveHintCount(this.hintCount);
              this.updateHintBadge();
              this.pendingDailyReward = false;
              this.showToast(t('reward.modal.bonus', { count: this.hintCount }));
              sounds.playBark();
            }
          }
        }
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
          if (backdrop.id === 'modal-dialog') {
            const resolve = this.dialogResolve;
            this.dialogResolve = null;
            if (resolve) resolve(false);
          }
          if (backdrop.id === 'modal-help') {
            storage.setHasSeenRules(true);
            if (!this.screenGameEl.classList.contains('hidden') && !this.isFinished) {
              this.startTimer();
            }
          }
          if (backdrop.id === 'modal-daily-reward') {
            const today = storage.getLocalDateString(new Date());
            if (!storage.hasDailyRewardClaimed(today)) {
              storage.setDailyRewardClaimed(today, true);
              this.hintCount += 5;
              storage.saveHintCount(this.hintCount);
              this.updateHintBadge();
              this.pendingDailyReward = false;
            }
          }
        }
      });
    });

    this.setupDialogModal();
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
    document.getElementById('btn-jump-level')?.addEventListener('click', async () => {
      const input = document.getElementById('input-jump-level') as HTMLInputElement;
      const level = parseInt(input.value, 10);
      if (level >= 1 && level <= MAX_STAGE_LEVEL) {
        document.getElementById('modal-stages')!.classList.add('hidden');
        this.screenTitleEl.classList.add('hidden');
        this.screenGameEl.classList.remove('hidden');
        this.startGame(level - 1);
      } else {
        await this.showAlert({
          title: t('dialog.title.notice'),
          message: t('msg.alert.jumpInvalid'),
          btnText: t('dialog.btn.ok'),
          icon: '🐕',
        });
      }
    });

    // Random generator
    document.getElementById('btn-generate-puzzle')?.addEventListener('click', () => {
      const selectEl = document.getElementById('select-random-size') as HTMLSelectElement;
      const size = parseInt(selectEl.value, 10);
      const generated = generateUniquePuzzle(size, {
        name: `Custom ${size}x${size}`,
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
    if (size === 10) return t('game.diff.master');
    switch (diff) {
      case 'beginner': return t('game.diff.beginner');
      case 'easy': return t('game.diff.easy');
      case 'medium': return t('game.diff.medium');
      case 'hard': return t('game.diff.hard');
      case 'expert': return t('game.diff.expert');
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
    const langSelect = document.getElementById('setting-language') as HTMLSelectElement;
    langSelect?.addEventListener('change', () => {
      const selected = (langSelect.value as 'auto' | 'ja' | 'en') || 'auto';
      this.settings.language = selected;
      i18n.setSetting(selected);
      i18n.applyTranslations();
      this.saveSettings();
      this.renderTitleScreen();
      if (this.diffValEl && this.currentPuzzle) {
        this.diffValEl.textContent = this.getDifficultyLabel(this.currentPuzzle.difficulty, this.currentPuzzle.size);
      }
      this.updateAutomarkBadge();
      this.switchTutorialSlide(this.currentTutorialSlide, false);
    });

    const shibaBtns = document.querySelectorAll('.shiba-choice-btn');
    shibaBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        shibaBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.shibaType = ((btn as HTMLElement).dataset.shiba as ShibaType) || 'aka';
        this.saveSettings();
        this.setupTitleMascot();
        this.renderBoard();
        this.renderTutorialVisuals();
      });
    });

    const soundToggle = document.getElementById('setting-sound') as HTMLInputElement;
    soundToggle?.addEventListener('change', () => {
      this.settings.soundEnabled = soundToggle.checked;
      this.saveSettings();
    });

    const vibrationToggle = document.getElementById('setting-vibration') as HTMLInputElement;
    vibrationToggle?.addEventListener('change', () => {
      this.settings.vibrationEnabled = vibrationToggle.checked;
      this.saveSettings();
      if (this.settings.vibrationEnabled) {
        this.vibrateLight(40);
      }
    });

    const autoMarkToggle = document.getElementById('setting-automark') as HTMLInputElement;
    autoMarkToggle?.addEventListener('change', () => {
      this.settings.autoMark = autoMarkToggle.checked;
      this.saveSettings();
    });

    const resetProgressBtn = document.getElementById('btn-reset-progress');
    resetProgressBtn?.addEventListener('click', async () => {
      const ok = await this.showConfirm({
        title: t('dialog.title.confirm'),
        message: t('msg.alert.resetConfirm'),
        confirmText: t('set.reset.btn'),
        cancelText: t('dialog.btn.cancel'),
        icon: '🗑️',
        isDanger: true,
      });
      if (ok) {
        storage.resetAllProgress();
        this.unlockedLevel = 1;
        this.completedLevels = {};
        this.tournamentPoints = 0;
        this.hintCount = 5;
        this.settings.autoMark = true;
        this.settings.vibrationEnabled = true;
        this.saveSettings();
        this.updateHintBadge();
        document.getElementById('modal-settings')?.classList.add('hidden');
        this.showTitleScreen();
        await this.showAlert({
          title: t('dialog.title.notice'),
          message: t('msg.alert.resetDone'),
          btnText: t('dialog.btn.ok'),
          icon: '🐾',
        });
      }
    });
  }

  private setupDialogModal() {
    const modal = document.getElementById('modal-dialog');
    const confirmBtn = document.getElementById('dialog-btn-confirm');
    const cancelBtn = document.getElementById('dialog-btn-cancel');

    confirmBtn?.addEventListener('click', () => {
      sounds.playPaw();
      this.vibrateLight(35);
      modal?.classList.add('hidden');
      const resolve = this.dialogResolve;
      this.dialogResolve = null;
      if (resolve) resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
      sounds.playPaw();
      this.vibrateLight(25);
      modal?.classList.add('hidden');
      const resolve = this.dialogResolve;
      this.dialogResolve = null;
      if (resolve) resolve(false);
    });

    // Intercept native alert to always use custom styled dialog
    window.alert = (msg?: unknown) => {
      this.showAlert({ message: String(msg ?? '') });
    };
  }

  public showConfirm(options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    icon?: string;
    isDanger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogResolve = resolve;
      const modal = document.getElementById('modal-dialog');
      const iconEl = document.getElementById('dialog-icon');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const cancelBtn = document.getElementById('dialog-btn-cancel') as HTMLButtonElement | null;
      const confirmBtn = document.getElementById('dialog-btn-confirm') as HTMLButtonElement | null;

      if (iconEl) iconEl.textContent = options.icon || '🐕';
      if (titleEl) titleEl.textContent = options.title || t('dialog.title.confirm');
      if (msgEl) msgEl.textContent = options.message;

      if (cancelBtn) {
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent = options.cancelText || t('dialog.btn.cancel');
      }

      if (confirmBtn) {
        confirmBtn.textContent = options.confirmText || t('dialog.btn.ok');
        confirmBtn.classList.toggle('btn-danger', !!options.isDanger);
        confirmBtn.classList.toggle('primary-btn', !options.isDanger);
      }

      modal?.classList.remove('hidden');
      this.vibrateLight(30);
    });
  }

  public showAlert(options: {
    title?: string;
    message: string;
    btnText?: string;
    icon?: string;
  }): Promise<void> {
    return new Promise((resolve) => {
      this.dialogResolve = () => resolve();
      const modal = document.getElementById('modal-dialog');
      const iconEl = document.getElementById('dialog-icon');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const cancelBtn = document.getElementById('dialog-btn-cancel') as HTMLButtonElement | null;
      const confirmBtn = document.getElementById('dialog-btn-confirm') as HTMLButtonElement | null;

      if (iconEl) iconEl.textContent = options.icon || '🐾';
      if (titleEl) titleEl.textContent = options.title || t('dialog.title.notice');
      if (msgEl) msgEl.textContent = options.message;

      if (cancelBtn) {
        cancelBtn.classList.add('hidden');
      }

      if (confirmBtn) {
        confirmBtn.textContent = options.btnText || t('dialog.btn.ok');
        confirmBtn.classList.remove('btn-danger');
        confirmBtn.classList.add('primary-btn');
      }

      modal?.classList.remove('hidden');
      this.vibrateLight(30);
    });
  }

  // Gamepad Controller Integration
  private getActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    try {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected) return gp;
      }
    } catch {}
    return null;
  }

  private updateGamepadBadge(connected: boolean) {
    const badge = document.getElementById('badge-device-gamepad');
    if (badge) {
      if (connected) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  private initGamepadSupport() {
    window.addEventListener('gamepadconnected', () => {
      this.isGamepadConnected = true;
      this.updateGamepadBadge(true);
      this.startGamepadLoop();
    });

    window.addEventListener('gamepaddisconnected', () => {
      const gp = this.getActiveGamepad();
      if (!gp) {
        this.isGamepadConnected = false;
        this.updateGamepadBadge(false);
      }
    });

    // Start polling loop so controllers connected prior to window focus are captured
    this.startGamepadLoop();
  }

  private startGamepadLoop() {
    if (this.gamepadLoopId !== null) return;
    const loop = () => {
      this.pollGamepad();
      this.gamepadLoopId = requestAnimationFrame(loop);
    };
    this.gamepadLoopId = requestAnimationFrame(loop);
  }

  private clearMenuFocus() {
    document.querySelectorAll('.menu-focused').forEach(el => el.classList.remove('menu-focused'));
  }

  private handleTitleScreenNav(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    action: boolean,
    start: boolean = false
  ) {
    const titleButtons = [
      document.getElementById('btn-title-play'),
      document.getElementById('btn-title-stages'),
      document.getElementById('btn-title-ranking'),
      document.getElementById('btn-title-controls'),
      document.getElementById('btn-title-help'),
      document.getElementById('btn-title-settings'),
    ].filter(Boolean) as HTMLElement[];

    if (titleButtons.length === 0) return;

    if (start) {
      document.getElementById('btn-title-play')?.click();
      return;
    }

    if (up || left) {
      this.titleFocusIdx = (this.titleFocusIdx - 1 + titleButtons.length) % titleButtons.length;
    } else if (down || right) {
      this.titleFocusIdx = (this.titleFocusIdx + 1) % titleButtons.length;
    }

    titleButtons.forEach((btn, idx) => {
      btn.classList.toggle('menu-focused', idx === this.titleFocusIdx);
    });

    if (action) {
      titleButtons[this.titleFocusIdx]?.click();
    }
  }

  private handleRankUpScreen(): boolean {
    const overlay = document.getElementById('modal-rankup');
    if (!overlay || overlay.classList.contains('hidden')) return false;
    overlay.click();
    return true;
  }

  private handleStagesModalNav(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-stages');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      this.clearMenuFocus();
      return;
    }

    const cells = Array.from(modal.querySelectorAll('.level-cell')) as HTMLElement[];
    const jumpBtn = document.getElementById('btn-jump-level') as HTMLElement | null;
    const genBtn = document.getElementById('btn-generate-puzzle') as HTMLElement | null;
    const totalItems = cells.length + (jumpBtn ? 1 : 0) + (genBtn ? 1 : 0);

    if (totalItems === 0) return;

    if (left) {
      this.stageFocusIdx = Math.max(0, this.stageFocusIdx - 1);
    } else if (right) {
      this.stageFocusIdx = Math.min(totalItems - 1, this.stageFocusIdx + 1);
    } else if (up) {
      if (this.stageFocusIdx >= cells.length) {
        this.stageFocusIdx = cells.length - 1;
      } else {
        this.stageFocusIdx = Math.max(0, this.stageFocusIdx - 3);
      }
    } else if (down) {
      if (this.stageFocusIdx < cells.length - 3) {
        this.stageFocusIdx += 3;
      } else if (this.stageFocusIdx < cells.length) {
        this.stageFocusIdx = cells.length;
      } else if (this.stageFocusIdx === cells.length && genBtn) {
        this.stageFocusIdx = cells.length + 1;
      }
    }

    cells.forEach((c, idx) => {
      const isFocused = idx === this.stageFocusIdx;
      c.classList.toggle('menu-focused', isFocused);
      if (isFocused) {
        c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });

    if (jumpBtn) {
      const isFocused = this.stageFocusIdx === cells.length;
      jumpBtn.classList.toggle('menu-focused', isFocused);
      if (isFocused) jumpBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (genBtn) {
      const isFocused = this.stageFocusIdx === cells.length + 1;
      genBtn.classList.toggle('menu-focused', isFocused);
      if (isFocused) genBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (action) {
      if (this.stageFocusIdx < cells.length) {
        cells[this.stageFocusIdx]?.click();
      } else if (this.stageFocusIdx === cells.length) {
        jumpBtn?.click();
      } else {
        genBtn?.click();
      }
    }
  }

  private handleLeaderboardModalNav(
    up: boolean,
    down: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-leaderboard');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      this.clearMenuFocus();
      return;
    }

    const playBtn = document.getElementById('btn-leaderboard-play');
    const closeBtn = modal.querySelector('.modal-close') as HTMLElement | null;

    if (up || down) {
      this.leaderboardFocusBtn = this.leaderboardFocusBtn === 'play' ? 'close' : 'play';
    }

    playBtn?.classList.toggle('menu-focused', this.leaderboardFocusBtn === 'play');
    closeBtn?.classList.toggle('menu-focused', this.leaderboardFocusBtn === 'close');

    if (action) {
      if (this.leaderboardFocusBtn === 'play') {
        playBtn?.click();
      } else {
        closeBtn?.click();
      }
    }
  }

  private handleSettingsModalNav(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-settings');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      this.clearMenuFocus();
      return;
    }

    const items = Array.from(modal.querySelectorAll('.setting-item')) as HTMLElement[];
    const saveBtn = modal.querySelector('[data-close-modal="modal-settings"]') as HTMLElement | null;
    const totalCount = items.length + (saveBtn ? 1 : 0);

    if (up) {
      this.settingsRowIdx = Math.max(0, this.settingsRowIdx - 1);
    } else if (down) {
      this.settingsRowIdx = Math.min(totalCount - 1, this.settingsRowIdx + 1);
    }

    items.forEach((item, idx) => {
      const isFocused = idx === this.settingsRowIdx;
      item.classList.toggle('menu-focused', isFocused);
      if (isFocused) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    if (saveBtn) {
      const isFocused = this.settingsRowIdx === items.length;
      saveBtn.classList.toggle('menu-focused', isFocused);
      if (isFocused) saveBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Row 0: Language
    if (this.settingsRowIdx === 0) {
      const langSelect = document.getElementById('setting-language') as HTMLSelectElement | null;
      if (langSelect && (left || right || action)) {
        const langs = ['auto', 'ja', 'en'];
        let curIdx = langs.indexOf(langSelect.value);
        if (curIdx === -1) curIdx = 0;
        const nextIdx = left ? (curIdx - 1 + langs.length) % langs.length : (curIdx + 1) % langs.length;
        langSelect.value = langs[nextIdx];
        langSelect.dispatchEvent(new Event('change'));
      }
    }
    // Row 1: Shiba Type
    else if (this.settingsRowIdx === 1) {
      const shibaBtns = Array.from(modal.querySelectorAll('.shiba-choice-btn')) as HTMLElement[];
      if (shibaBtns.length > 0 && (left || right || action)) {
        let curIdx = shibaBtns.findIndex(b => b.classList.contains('active'));
        if (curIdx === -1) curIdx = 0;
        const nextIdx = left ? (curIdx - 1 + shibaBtns.length) % shibaBtns.length : (curIdx + 1) % shibaBtns.length;
        shibaBtns[nextIdx]?.click();
      }
    }
    // Row 2: Sound
    else if (this.settingsRowIdx === 2) {
      const toggle = document.getElementById('setting-sound') as HTMLInputElement | null;
      if (toggle && (left || right || action)) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      }
    }
    // Row 3: Vibration
    else if (this.settingsRowIdx === 3) {
      const toggle = document.getElementById('setting-vibration') as HTMLInputElement | null;
      if (toggle && (left || right || action)) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      }
    }
    // Row 4: AutoMark
    else if (this.settingsRowIdx === 4) {
      const toggle = document.getElementById('setting-automark') as HTMLInputElement | null;
      if (toggle && (left || right || action)) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      }
    }
    // Row 5: Reset Progress
    else if (this.settingsRowIdx === 5) {
      if (action) {
        document.getElementById('btn-reset-progress')?.click();
      }
    }
    // Row 6: Save & Close button
    else if (this.settingsRowIdx === items.length) {
      if (action) {
        saveBtn?.click();
      }
    }
  }

  private handleTutorialModalNav(
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-help');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      storage.setHasSeenRules(true);
      if (!this.screenGameEl.classList.contains('hidden') && !this.isFinished) {
        this.startTimer();
      }
      return;
    }

    if (left) {
      document.getElementById('btn-tutorial-prev')?.click();
    } else if (right || action) {
      document.getElementById('btn-tutorial-next')?.click();
    }
  }

  private handleControlsModalNav(
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-controls');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel || action) {
      modal.classList.add('hidden');
      return;
    }

    const tabs: Array<'pc' | 'mobile' | 'gamepad'> = ['pc', 'mobile', 'gamepad'];
    const currentActive = (modal.querySelector('.controls-tab-btn.active')?.getAttribute('data-tab') as 'pc' | 'mobile' | 'gamepad') || 'pc';
    const currentIdx = tabs.indexOf(currentActive);

    if (left) {
      const nextTab = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
      this.switchControlsTab(nextTab);
    } else if (right) {
      const nextTab = tabs[(currentIdx + 1) % tabs.length];
      this.switchControlsTab(nextTab);
    }
  }

  private handleCustomDialogNav(
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-dialog');
    if (!modal || modal.classList.contains('hidden')) return;

    const cancelBtn = document.getElementById('dialog-btn-cancel') as HTMLElement | null;
    const confirmBtn = document.getElementById('dialog-btn-confirm') as HTMLElement | null;
    const hasCancel = Boolean(cancelBtn && !cancelBtn.classList.contains('hidden'));

    if (cancel) {
      if (hasCancel) {
        cancelBtn?.click();
      } else {
        confirmBtn?.click();
      }
      return;
    }

    if (hasCancel && (left || right)) {
      this.dialogFocusBtn = this.dialogFocusBtn === 'confirm' ? 'cancel' : 'confirm';
    }

    confirmBtn?.classList.toggle('menu-focused', this.dialogFocusBtn === 'confirm' || !hasCancel);
    cancelBtn?.classList.toggle('menu-focused', hasCancel && this.dialogFocusBtn === 'cancel');

    if (action) {
      if (hasCancel && this.dialogFocusBtn === 'cancel') {
        cancelBtn?.click();
      } else {
        confirmBtn?.click();
      }
    }
  }

  private handleWinModalNav(
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-win');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      this.showTitleScreen();
      return;
    }

    const replayBtn = document.getElementById('btn-win-replay');
    const rankBtn = document.getElementById('btn-win-ranking');
    const nextBtn = document.getElementById('btn-win-next');
    const btns = [replayBtn, rankBtn, nextBtn].filter(Boolean) as HTMLElement[];

    if (left) {
      this.winModalFocusIdx = Math.max(0, this.winModalFocusIdx - 1);
    } else if (right) {
      this.winModalFocusIdx = Math.min(btns.length - 1, this.winModalFocusIdx + 1);
    }

    btns.forEach((b, idx) => {
      b.classList.toggle('menu-focused', idx === this.winModalFocusIdx);
    });

    if (action) {
      btns[this.winModalFocusIdx]?.click();
    }
  }

  private handleGameOverModalNav(
    left: boolean,
    right: boolean,
    action: boolean,
    cancel: boolean
  ) {
    const modal = document.getElementById('modal-gameover');
    if (!modal || modal.classList.contains('hidden')) return;

    if (cancel) {
      modal.classList.add('hidden');
      this.showTitleScreen();
      return;
    }

    const homeBtn = document.getElementById('btn-gameover-home');
    const retryBtn = document.getElementById('btn-gameover-retry');
    const btns = [homeBtn, retryBtn].filter(Boolean) as HTMLElement[];

    if (left || right) {
      this.gameOverFocusIdx = this.gameOverFocusIdx === 0 ? 1 : 0;
    }

    btns.forEach((b, idx) => {
      b.classList.toggle('menu-focused', idx === this.gameOverFocusIdx);
    });

    if (action) {
      btns[this.gameOverFocusIdx]?.click();
    }
  }

  private handleDailyRewardModalNav(action: boolean, cancel: boolean) {
    const modal = document.getElementById('modal-daily-reward');
    if (!modal || modal.classList.contains('hidden')) return;

    if (action || cancel) {
      const today = storage.getLocalDateString(new Date());
      if (!storage.hasDailyRewardClaimed(today)) {
        storage.setDailyRewardClaimed(today, true);
        this.hintCount += 5;
        storage.saveHintCount(this.hintCount);
        this.updateHintBadge();
        this.pendingDailyReward = false;
      }
      modal.classList.add('hidden');
    }
  }

  private pollGamepad() {
    const gp = this.getActiveGamepad();
    if (!gp) {
      this.prevGamepadButtons = [];
      this.gamepadDirActive = '';
      return;
    }

    if (!this.isGamepadConnected) {
      this.isGamepadConnected = true;
      this.updateGamepadBadge(true);
    }

    const isBtnDown = (btn?: GamepadButton | number): boolean => {
      if (btn === undefined || btn === null) return false;
      if (typeof btn === 'number') return btn > 0.5;
      return Boolean(btn.pressed || btn.value > 0.5);
    };

    const justPressed = (btnIndex: number): boolean => {
      const isDown = isBtnDown(gp.buttons[btnIndex]);
      return isDown && !this.prevGamepadButtons[btnIndex];
    };

    // Calculate directional inputs (D-Pad + Left Analog Stick)
    const axisX = gp.axes[0] !== undefined ? gp.axes[0] : 0;
    const axisY = gp.axes[1] !== undefined ? gp.axes[1] : 0;
    const isDpadUp = isBtnDown(gp.buttons[12]);
    const isDpadDown = isBtnDown(gp.buttons[13]);
    const isDpadLeft = isBtnDown(gp.buttons[14]);
    const isDpadRight = isBtnDown(gp.buttons[15]);

    const rawUp = isDpadUp || axisY < -0.48;
    const rawDown = isDpadDown || axisY > 0.48;
    const rawLeft = isDpadLeft || axisX < -0.48;
    const rawRight = isDpadRight || axisX > 0.48;
    const dirKey = `${rawUp ? 'U' : ''}${rawDown ? 'D' : ''}${rawLeft ? 'L' : ''}${rawRight ? 'R' : ''}`;
    const now = performance.now();

    let navStep = false;
    if (dirKey === '') {
      this.gamepadDirActive = '';
      this.gamepadNextRepeatTime = 0;
    } else if (dirKey !== this.gamepadDirActive) {
      navStep = true;
      this.gamepadDirActive = dirKey;
      this.gamepadNextRepeatTime = now + 230; // initial hold delay
    } else if (now >= this.gamepadNextRepeatTime) {
      navStep = true;
      this.gamepadNextRepeatTime = now + 110; // repeat rate
    }

    const stepUp = navStep && rawUp;
    const stepDown = navStep && rawDown;
    const stepLeft = navStep && rawLeft;
    const stepRight = navStep && rawRight;

    const isAnyBtnPressed = gp.buttons.some(b => isBtnDown(b));
    const isStickMoved = Math.abs(axisX) > 0.45 || Math.abs(axisY) > 0.45;
    if (isAnyBtnPressed || isStickMoved) {
      this.inputDevice = 'gamepad';
      document.body.classList.add('gamepad-active');
    }

    // 1. Check Rank-Up Overlay (Highest priority modal screen!)
    if (
      justPressed(0) ||
      justPressed(1) ||
      justPressed(2) ||
      justPressed(3) ||
      justPressed(9) ||
      justPressed(4) ||
      justPressed(5)
    ) {
      if (this.handleRankUpScreen()) {
        for (let i = 0; i < gp.buttons.length; i++) {
          this.prevGamepadButtons[i] = isBtnDown(gp.buttons[i]);
        }
        return;
      }
    }

    // 2. Check Modals
    const activeModal = document.querySelector('.modal-backdrop:not(.hidden)') as HTMLElement | null;
    if (activeModal) {
      if (activeModal.id === 'modal-dialog') {
        this.handleCustomDialogNav(stepLeft, stepRight, justPressed(0) || justPressed(9), justPressed(1));
      } else if (activeModal.id === 'modal-stages') {
        this.handleStagesModalNav(stepUp, stepDown, stepLeft, stepRight, justPressed(0), justPressed(1));
      } else if (activeModal.id === 'modal-settings') {
        this.handleSettingsModalNav(stepUp, stepDown, stepLeft, stepRight, justPressed(0), justPressed(1) || justPressed(9));
      } else if (activeModal.id === 'modal-leaderboard') {
        this.handleLeaderboardModalNav(stepUp || stepLeft, stepDown || stepRight, justPressed(0) || justPressed(9), justPressed(1));
      } else if (activeModal.id === 'modal-help') {
        this.handleTutorialModalNav(stepLeft || justPressed(4), stepRight || justPressed(5), justPressed(0), justPressed(1));
      } else if (activeModal.id === 'modal-controls') {
        this.handleControlsModalNav(stepLeft || justPressed(4), stepRight || justPressed(5), justPressed(0) || justPressed(1), justPressed(1));
      } else if (activeModal.id === 'modal-win') {
        this.handleWinModalNav(stepLeft, stepRight, justPressed(0) || justPressed(9), justPressed(1));
      } else if (activeModal.id === 'modal-gameover') {
        this.handleGameOverModalNav(stepLeft, stepRight, justPressed(0) || justPressed(9), justPressed(1));
      } else if (activeModal.id === 'modal-daily-reward') {
        this.handleDailyRewardModalNav(justPressed(0) || justPressed(9), justPressed(1));
      } else {
        if (justPressed(1)) {
          activeModal.classList.add('hidden');
        } else if (justPressed(0) || justPressed(9)) {
          const btn = activeModal.querySelector('.primary-btn, [data-close-modal]') as HTMLElement | null;
          btn?.click();
        }
      }

      for (let i = 0; i < gp.buttons.length; i++) {
        this.prevGamepadButtons[i] = isBtnDown(gp.buttons[i]);
      }
      return;
    }

    // 3. Handle Title Screen
    if (!this.screenTitleEl.classList.contains('hidden')) {
      this.handleTitleScreenNav(stepUp, stepDown, stepLeft, stepRight, justPressed(0), justPressed(9));
      for (let i = 0; i < gp.buttons.length; i++) {
        this.prevGamepadButtons[i] = isBtnDown(gp.buttons[i]);
      }
      return;
    }

    // 4. Handle Game Screen
    if (this.screenGameEl.classList.contains('hidden') || this.isFinished) {
      for (let i = 0; i < gp.buttons.length; i++) {
        this.prevGamepadButtons[i] = isBtnDown(gp.buttons[i]);
      }
      return;
    }

    // In-Game Grid Cursor Navigation
    if (!this.focusedPos) {
      this.setFocusedCell(0, 0, 'gamepad');
    }

    if (navStep && this.focusedPos) {
      const size = this.currentPuzzle.size;
      let newR = this.focusedPos.r;
      let newC = this.focusedPos.c;
      if (rawUp) newR = Math.max(0, newR - 1);
      if (rawDown) newR = Math.min(size - 1, newR + 1);
      if (rawLeft) newC = Math.max(0, newC - 1);
      if (rawRight) newC = Math.min(size - 1, newC + 1);
      if (newR !== this.focusedPos.r || newC !== this.focusedPos.c) {
        this.setFocusedCell(newR, newC, 'gamepad');
      }
    }

    // Action buttons:
    // A (0): Cross
    if (justPressed(0)) {
      if (this.focusedPos) {
        this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'cross');
      }
    }
    // B (1): Shiba (Dog)
    if (justPressed(1)) {
      if (this.focusedPos) {
        this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'dog');
      }
    }
    // X (2): Question mark
    if (justPressed(2)) {
      if (this.focusedPos) {
        this.handleCellClick(this.focusedPos.r, this.focusedPos.c, 'question');
      }
    }
    // Y (3): Erase
    if (justPressed(3)) {
      if (this.focusedPos) {
        this.eraseCell(this.focusedPos.r, this.focusedPos.c);
      }
    }
    // LB (4) or LT (6): Undo
    if (justPressed(4) || justPressed(6)) {
      this.undo();
    }
    // RB (5) or RT (7): Hint
    if (justPressed(5) || justPressed(7)) {
      this.showHint();
    }
    // Start (9): Settings
    if (justPressed(9)) {
      this.syncSettingsUI();
      document.getElementById('modal-settings')?.classList.remove('hidden');
    }
    // Select (8): Controls Guide
    if (justPressed(8)) {
      this.showControlsModal();
    }
    // L3 (10): Return to Title screen
    if (justPressed(10)) {
      this.showTitleScreen();
    }
    // R3 (11): Reset Puzzle
    if (justPressed(11)) {
      document.getElementById('btn-reset')?.click();
    }

    // Store button states for next frame
    for (let i = 0; i < gp.buttons.length; i++) {
      this.prevGamepadButtons[i] = isBtnDown(gp.buttons[i]);
    }
  }

  private syncSettingsUI() {
    const langSelect = document.getElementById('setting-language') as HTMLSelectElement;
    if (langSelect) {
      langSelect.value = this.settings.language || 'auto';
    }

    const shibaBtns = document.querySelectorAll('.shiba-choice-btn');
    shibaBtns.forEach((btn) => {
      btn.classList.toggle(
        'active',
        (btn as HTMLElement).dataset.shiba === this.settings.shibaType
      );
    });

    const soundToggle = document.getElementById('setting-sound') as HTMLInputElement;
    if (soundToggle) soundToggle.checked = this.settings.soundEnabled;

    const vibrationToggle = document.getElementById('setting-vibration') as HTMLInputElement;
    if (vibrationToggle) vibrationToggle.checked = this.settings.vibrationEnabled;

    const autoMarkToggle = document.getElementById('setting-automark') as HTMLInputElement;
    if (autoMarkToggle) autoMarkToggle.checked = this.settings.autoMark;
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new InudokuGame();
});

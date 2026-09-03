import confetti from 'canvas-confetti';
import { PRESET_STAGES } from './logic/stages';
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
import { getPawSvg, getShibaSvg, REGION_COLORS, ShibaType } from './graphics/shiba';

class InudokuGame {
  private currentPuzzle: PuzzleDefinition = PRESET_STAGES[0];
  private currentStageIndex: number = 0;
  private grid: CellState[][] = [];
  private undoStack: MoveAction[][] = []; // grouped moves for undo (e.g. dog + auto-crosses)
  private inputMode: 'dog' | 'mark' = 'dog';
  private isPointerDown: boolean = false;
  private dragMark: CellMark | null = null;

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

  // DOM Elements
  private gridBoardEl!: HTMLElement;
  private dogCounterEl!: HTMLElement;
  private timerValEl!: HTMLElement;
  private stageBadgeEl!: HTMLElement;
  private hintBubbleEl!: HTMLElement;
  private hintBubbleTextEl!: HTMLElement;
  private automarkBadgeEl!: HTMLElement;

  constructor() {
    this.loadSettings();
    this.initDOMElements();
    this.bindEvents();
    this.loadStage(0);
  }

  private initDOMElements() {
    this.gridBoardEl = document.getElementById('grid-board')!;
    this.dogCounterEl = document.getElementById('dog-counter')!;
    this.timerValEl = document.getElementById('timer-val')!;
    this.stageBadgeEl = document.getElementById('stage-badge')!;
    this.hintBubbleEl = document.getElementById('hint-bubble')!;
    this.hintBubbleTextEl = document.getElementById('hint-bubble-text')!;
    this.automarkBadgeEl = document.getElementById('automark-badge')!;

    this.updateAutomarkBadge();
  }

  private loadSettings() {
    const saved = localStorage.getItem('inudoku_settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    sounds.setEnabled(this.settings.soundEnabled);
  }

  private saveSettings() {
    localStorage.setItem('inudoku_settings', JSON.stringify(this.settings));
    sounds.setEnabled(this.settings.soundEnabled);
    this.updateAutomarkBadge();
  }

  private updateAutomarkBadge() {
    if (this.automarkBadgeEl) {
      this.automarkBadgeEl.textContent = this.settings.autoMark ? 'ON' : 'OFF';
      this.automarkBadgeEl.classList.toggle('off', !this.settings.autoMark);
    }
  }

  public loadStage(index: number) {
    if (index >= 0 && index < PRESET_STAGES.length) {
      this.currentStageIndex = index;
      this.initPuzzle(PRESET_STAGES[index]);
    }
  }

  public initPuzzle(puzzle: PuzzleDefinition) {
    this.currentPuzzle = puzzle;
    this.undoStack = [];
    this.isFinished = false;
    this.resetTimer();
    this.startTimer();
    this.hideHint();

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

    this.stageBadgeEl.textContent = `${puzzle.size}x${puzzle.size} ${puzzle.name}`;
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

        // Region color
        const color = REGION_COLORS[cell.region % REGION_COLORS.length];
        cellEl.style.setProperty('--cell-bg', color);

        // Region borders
        if (r === 0 || this.grid[r - 1][c].region !== cell.region) {
          cellEl.classList.add('border-top-region');
        }
        if (r === size - 1 || this.grid[r + 1][c].region !== cell.region) {
          cellEl.classList.add('border-bottom-region');
        }
        if (c === 0 || this.grid[r][c - 1].region !== cell.region) {
          cellEl.classList.add('border-left-region');
        }
        if (c === size - 1 || this.grid[r][c + 1].region !== cell.region) {
          cellEl.classList.add('border-right-region');
        }

        this.renderCellContent(cellEl, cell);
        this.gridBoardEl.appendChild(cellEl);
      }
    }
  }

  private renderCellContent(cellEl: HTMLElement, cell: CellState) {
    cellEl.innerHTML = '';
    cellEl.classList.toggle('cell-conflict', cell.isConflict);

    if (cell.mark === 'dog') {
      const state = cell.isConflict ? 'conflict' : 'normal';
      cellEl.innerHTML = `<div class="cell-dog">${getShibaSvg(this.settings.shibaType, state)}</div>`;
    } else if (cell.mark === 'cross') {
      cellEl.innerHTML = `<div class="cell-paw">${getPawSvg()}</div>`;
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

  private handleCellClick(r: number, c: number, forceMark?: 'dog' | 'cross') {
    if (this.isFinished) return;

    const cell = this.grid[r][c];
    const prevMark = cell.mark;
    let targetMark: CellMark = 'empty';

    if (forceMark === 'cross') {
      // Right-click or dedicated mark action
      targetMark = prevMark === 'cross' ? 'empty' : 'cross';
    } else if (this.inputMode === 'dog') {
      if (prevMark === 'dog') {
        targetMark = 'empty';
      } else {
        targetMark = 'dog';
      }
    } else {
      // Mark mode
      if (prevMark === 'cross') {
        targetMark = 'empty';
      } else {
        targetMark = 'cross';
      }
    }

    if (targetMark === prevMark) return;

    // Strict Rule Enforcement:
    // Prevent violating "1 per row, 1 per col, 1 per color, no 8-way adjacent"
    if (targetMark === 'dog') {
      if (prevMark === 'cross') {
        this.flashDeny(r, c, '足跡🐾のあるマスには柴犬を置けないワン！先に足跡を解除してね。');
        return;
      }

      // Check same row
      const sameRowDog = this.findDogInRow(r, c);
      if (sameRowDog) {
        this.flashDeny(r, c, '同じ横列には1匹しか置けないワン！', sameRowDog);
        return;
      }

      // Check same column
      const sameColDog = this.findDogInCol(r, c);
      if (sameColDog) {
        this.flashDeny(r, c, '同じ縦列には1匹しか置けないワン！', sameColDog);
        return;
      }

      // Check same color region
      const sameRegDog = this.findDogInRegion(cell.region, r, c);
      if (sameRegDog) {
        this.flashDeny(r, c, '同じ色のエリアには1匹しか置けないワン！', sameRegDog);
        return;
      }

      // Check 8-neighborhood personal space
      const adjacentDog = this.findAdjacentDog(r, c);
      if (adjacentDog) {
        this.flashDeny(r, c, '柴犬同士が近すぎるワン！（パーソナルスペース）', adjacentDog);
        return;
      }
    }

    // Apply move
    const moves: MoveAction[] = [{ r, c, prevMark, newMark: targetMark }];
    cell.mark = targetMark;

    // Sound effect
    if (targetMark === 'dog') {
      sounds.playBark();
    } else if (targetMark === 'cross') {
      sounds.playPaw();
    } else {
      sounds.playErase();
    }

    // Auto-mark nearby cells if dog was placed
    if (targetMark === 'dog' && this.settings.autoMark) {
      const autoCrosses = getAutoCrossCells(r, c, this.currentPuzzle, this.grid);
      for (const ac of autoCrosses) {
        moves.push({
          r: ac.r,
          c: ac.c,
          prevMark: this.grid[ac.r][ac.c].mark,
          newMark: 'cross',
        });
        this.grid[ac.r][ac.c].mark = 'cross';
        this.updateCellView(ac.r, ac.c);
      }
    }

    this.undoStack.push(moves);
    this.updateCellView(r, c);
    this.validateAndCheckWin();
  }

  private findDogInRow(r: number, excludeC: number): Position | null {
    for (let col = 0; col < this.currentPuzzle.size; col++) {
      if (col !== excludeC && this.grid[r][col].mark === 'dog') {
        return { r, c: col };
      }
    }
    return null;
  }

  private findDogInCol(c: number, excludeR: number): Position | null {
    for (let row = 0; row < this.currentPuzzle.size; row++) {
      if (row !== excludeR && this.grid[row][c].mark === 'dog') {
        return { r: row, c };
      }
    }
    return null;
  }

  private findDogInRegion(regionId: number, excludeR: number, excludeC: number): Position | null {
    const size = this.currentPuzzle.size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r !== excludeR || c !== excludeC) && this.grid[r][c].region === regionId) {
          if (this.grid[r][c].mark === 'dog') {
            return { r, c };
          }
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

  private flashDeny(r: number, c: number, message: string, conflictWith?: Position) {
    sounds.playConflict();

    const cellEl = document.getElementById(`cell-${r}-${c}`);
    if (cellEl) {
      cellEl.classList.remove('cell-deny');
      void cellEl.offsetWidth; // trigger reflow
      cellEl.classList.add('cell-deny');
      setTimeout(() => cellEl.classList.remove('cell-deny'), 400);
    }

    if (conflictWith) {
      const otherEl = document.getElementById(`cell-${conflictWith.r}-${conflictWith.c}`);
      if (otherEl) {
        otherEl.classList.remove('cell-deny');
        void otherEl.offsetWidth;
        otherEl.classList.add('cell-deny');
        setTimeout(() => otherEl.classList.remove('cell-deny'), 400);
      }
    }

    // Show temporary warning bubble
    this.hintBubbleTextEl.textContent = message;
    this.hintBubbleEl.classList.remove('hidden');

    if (this.hintTimeout !== null) {
      clearTimeout(this.hintTimeout);
    }
    this.hintTimeout = window.setTimeout(() => {
      this.hideHint();
    }, 2200);
  }


  private validateAndCheckWin() {
    const valResult = validateGrid(this.grid, this.currentPuzzle);
    this.updateAllConflicts(valResult.conflictingCells);
    this.updateStatus(valResult.dogCount);

    if (valResult.conflictingCells.size > 0) {
      sounds.playConflict();
    }

    if (valResult.isComplete && !this.isFinished) {
      this.handleVictory();
    }
  }

  private handleVictory() {
    this.isFinished = true;
    this.stopTimer();
    sounds.playWin();

    // Confetti celebration
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#E78B3F', '#FDE68A', '#A7F3D0', '#BAE6FD', '#FBCFE8'],
    });

    // Populate and open victory modal
    const winModal = document.getElementById('modal-win')!;
    const winTimeEl = document.getElementById('win-time')!;
    const winDogsEl = document.getElementById('win-dogs')!;
    const victoryShibaEl = document.getElementById('victory-shiba-container')!;

    winTimeEl.textContent = this.formatTime(this.elapsedSeconds);
    winDogsEl.textContent = `${this.currentPuzzle.size} 匹`;
    victoryShibaEl.innerHTML = getShibaSvg(this.settings.shibaType, 'happy');

    setTimeout(() => {
      winModal.classList.remove('hidden');
    }, 600);
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
    // Reverse application
    for (let i = moves.length - 1; i >= 0; i--) {
      const m = moves[i];
      this.grid[m.r][m.c].mark = m.prevMark;
      this.updateCellView(m.r, m.c);
    }

    sounds.playErase();
    this.validateAndCheckWin();
  }

  private hintTimeout: number | null = null;

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

      // Highlight target cell
      const targetEl = document.getElementById(`cell-${hint.pos.r}-${hint.pos.c}`);
      if (targetEl) {
        targetEl.style.outline = '3px solid var(--color-primary)';
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

    // Auto-dismiss after 5 seconds
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


  // Timer Methods
  private startTimer() {
    this.stopTimer();
    this.timerInterval = window.setInterval(() => {
      this.elapsedSeconds++;
      this.timerValEl.textContent = this.formatTime(this.elapsedSeconds);
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

  private bindEvents() {
    // Cell Click & Drag interactions
    this.gridBoardEl.addEventListener('mousedown', (e) => {
      if (e.button === 2) return; // right click handled by contextmenu
      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cellEl) {
        this.isPointerDown = true;
        const r = parseInt(cellEl.dataset.r!, 10);
        const c = parseInt(cellEl.dataset.c!, 10);

        if (this.inputMode === 'mark') {
          this.dragMark = this.grid[r][c].mark === 'cross' ? 'empty' : 'cross';
        }
        this.handleCellClick(r, c);
      }
    });

    this.gridBoardEl.addEventListener('mouseover', (e) => {
      if (!this.isPointerDown || this.inputMode !== 'mark' || !this.dragMark) return;
      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cellEl) {
        const r = parseInt(cellEl.dataset.r!, 10);
        const c = parseInt(cellEl.dataset.c!, 10);
        const cell = this.grid[r][c];
        if (cell.mark !== 'dog' && cell.mark !== this.dragMark) {
          const prevMark = cell.mark;
          cell.mark = this.dragMark;
          this.undoStack.push([{ r, c, prevMark, newMark: this.dragMark }]);
          this.updateCellView(r, c);
          sounds.playPaw();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
      this.dragMark = null;
    });

    // Right click to place/remove paw mark
    this.gridBoardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cellEl = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cellEl) {
        const r = parseInt(cellEl.dataset.r!, 10);
        const c = parseInt(cellEl.dataset.c!, 10);
        this.handleCellClick(r, c, 'cross');
      }
    });

    // Mode Toggle Buttons
    const modeDogBtn = document.getElementById('mode-dog')!;
    const modeMarkBtn = document.getElementById('mode-mark')!;

    modeDogBtn.addEventListener('click', () => {
      this.inputMode = 'dog';
      modeDogBtn.classList.add('active');
      modeMarkBtn.classList.remove('active');
    });

    modeMarkBtn.addEventListener('click', () => {
      this.inputMode = 'mark';
      modeMarkBtn.classList.add('active');
      modeDogBtn.classList.remove('active');
    });

    // Action Buttons
    document.getElementById('btn-undo')!.addEventListener('click', () => this.undo());
    document.getElementById('btn-hint')!.addEventListener('click', () => this.showHint());
    document.getElementById('btn-reset')!.addEventListener('click', () => {
      if (confirm('盤面をリセットして最初からやり直しますか？')) {
        this.initPuzzle(this.currentPuzzle);
      }
    });
    document.getElementById('btn-close-hint')!.addEventListener('click', () => this.hideHint());

    // Auto-mark button toggle
    document.getElementById('btn-automark')!.addEventListener('click', () => {
      this.settings.autoMark = !this.settings.autoMark;
      this.saveSettings();
    });

    // Modals open/close
    this.bindModals();

    // Stage Selector Setup
    this.setupStageModal();

    // Settings Modal Setup
    this.setupSettingsModal();

    // Victory actions
    document.getElementById('btn-win-replay')!.addEventListener('click', () => {
      document.getElementById('modal-win')!.classList.add('hidden');
      this.initPuzzle(this.currentPuzzle);
    });

    document.getElementById('btn-win-next')!.addEventListener('click', () => {
      document.getElementById('modal-win')!.classList.add('hidden');
      const nextIndex = (this.currentStageIndex + 1) % PRESET_STAGES.length;
      this.loadStage(nextIndex);
    });
  }

  private bindModals() {
    // Open buttons
    document.getElementById('btn-help')!.addEventListener('click', () => {
      document.getElementById('modal-help')!.classList.remove('hidden');
    });
    document.getElementById('btn-stages')!.addEventListener('click', () => {
      this.renderStageList();
      document.getElementById('modal-stages')!.classList.remove('hidden');
    });
    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.syncSettingsUI();
      document.getElementById('modal-settings')!.classList.remove('hidden');
    });

    // Close buttons with data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const modalId = (e.currentTarget as HTMLElement).dataset.closeModal;
        if (modalId) {
          document.getElementById(modalId)?.classList.add('hidden');
        }
      });
    });

    // Click outside modal card to close
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
        }
      });
    });
  }

  private setupStageModal() {
    // Stage Filter Tabs
    const tabs = document.querySelectorAll('.stage-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = (tab as HTMLElement).dataset.filter || 'all';
        this.renderStageList(filter);
      });
    });

    // Random Puzzle Generator Button
    document.getElementById('btn-generate-puzzle')!.addEventListener('click', () => {
      const selectEl = document.getElementById('select-random-size') as HTMLSelectElement;
      const size = parseInt(selectEl.value, 10);
      const generated = generateUniquePuzzle(size, {
        name: `カスタム ${size}x${size}`,
      });
      document.getElementById('modal-stages')!.classList.add('hidden');
      this.initPuzzle(generated);
    });
  }

  private renderStageList(filter: string = 'all') {
    const listEl = document.getElementById('stages-list')!;
    listEl.innerHTML = '';

    PRESET_STAGES.forEach((stage, idx) => {
      if (filter !== 'all' && stage.difficulty !== filter) {
        return;
      }

      const card = document.createElement('div');
      card.className = `stage-card ${idx === this.currentStageIndex ? 'active-stage' : ''}`;
      card.innerHTML = `
        <div class="stage-card-title">${stage.name}</div>
        <div class="stage-card-meta">
          <span>難易度: ${this.getDifficultyLabel(stage.difficulty)}</span>
          <span>${stage.size}x${stage.size}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        this.loadStage(idx);
        document.getElementById('modal-stages')!.classList.add('hidden');
      });
      listEl.appendChild(card);
    });
  }

  private getDifficultyLabel(diff: string): string {
    switch (diff) {
      case 'beginner': return '入門';
      case 'easy': return '初級';
      case 'medium': return '中級';
      case 'hard': return '上級';
      case 'expert': return '名人';
      default: return diff;
    }
  }

  private setupSettingsModal() {
    // Shiba Type Buttons
    const shibaBtns = document.querySelectorAll('.shiba-choice-btn');
    shibaBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        shibaBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.shibaType = ((btn as HTMLElement).dataset.shiba as ShibaType) || 'aka';
        this.saveSettings();
        this.renderBoard();
      });
    });

    // Sound Switch
    const soundToggle = document.getElementById('setting-sound') as HTMLInputElement;
    soundToggle.addEventListener('change', () => {
      this.settings.soundEnabled = soundToggle.checked;
      this.saveSettings();
    });

    // Auto-mark Switch
    const autoMarkToggle = document.getElementById('setting-automark') as HTMLInputElement;
    autoMarkToggle.addEventListener('change', () => {
      this.settings.autoMark = autoMarkToggle.checked;
      this.saveSettings();
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

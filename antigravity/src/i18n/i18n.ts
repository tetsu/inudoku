/**
 * Shibadoku i18n (Internationalization) Engine
 * Supports Japanese (ja) and English (en).
 * Automatically detects user environment while allowing manual override.
 */

export type SupportedLang = 'ja' | 'en';
export type LangSetting = 'auto' | 'ja' | 'en';

export const DICTIONARY: Record<SupportedLang, Record<string, string>> = {
  ja: {
    // App Meta
    'app.title': 'Shibadoku (柴独) - 柴犬たちのロジックパズル',
    'app.description': 'Zoodoku/Meowdokuスタイルの柴犬ロジックパズルゲーム。各行・各列・各エリアに柴犬を1匹ずつ配置して、パーソナルスペースを守ろう！',

    // Title Screen
    'title.logo': 'Shibadoku',
    'title.sublogo': '柴独',
    'title.tagline': '柴犬たちのパーソナルスペース・ロジックパズル',
    'title.btn.play': 'あそぶ（レベル {level}）',
    'title.btn.resume': 'つづきから (レベル {level}) 🐾',
    'title.btn.stages': 'ステージ',
    'title.btn.ranking': 'ランキング',
    'title.btn.controls': '操作ガイド',
    'title.btn.rules': 'ルール',
    'title.btn.settings': '設定',
    'title.footer.cleared': 'クリア達成: {completed} / {total}',

    // Gameplay Header & Subbar
    'game.header.home': 'タイトルへ戻る',
    'game.header.level': 'レベル',
    'game.header.time': 'タイム',
    'game.header.difficulty': '難易度',
    'game.diff.beginner': '入門',
    'game.diff.easy': '初級',
    'game.diff.medium': '中級',
    'game.diff.hard': '上級',
    'game.diff.expert': '名人',
    'game.diff.master': '超名人',
    'game.header.controls': '操作方法',
    'game.header.ranking': 'ランキング',
    'game.header.settings': '設定',

    // Mini Rules Bar
    'game.minirule.tooltip': 'ルールを見る',
    'game.minirule.color': '1色に1匹',
    'game.minirule.rowcol': '行と列に1匹ずつ',
    'game.minirule.adjacent': '柴犬同士は隣接不可',

    // Bottom Controls
    'game.btn.dog': '柴犬 (Wタップ)',
    'game.btn.mark': 'バツ印 (タップ)',
    'game.btn.hint': 'ヒント',
    'game.btn.undo': '戻す',
    'game.btn.automark': '自動✕: ',
    'game.btn.reset': 'リセット',

    // In-game Alert / Flash Messages
    'msg.deny.row': '同じ横列（行）には1匹しか置けないワン！',
    'msg.deny.col': '同じ縦列（列）には1匹しか置けないワン！',
    'msg.deny.region': '同じ色のエリアには1匹しか置けないワン！',
    'msg.deny.adjacent': '柴犬同士が近すぎるワン！（斜めも含めて8マス接触禁止）',
    'msg.deny.solution': 'そこは柴犬の居場所じゃないワン！（間違ったマスです）',
    'msg.hint.smooth': '順調だワン！この調子で空いているエリアを探してみよう。',
    'msg.hint.conflict': 'ここにいる柴犬は他の柴犬とケンカしてしまう場所にあるワン！場所を見直してみよう。',
    'msg.hint.place': '{row}行目、{region} に柴犬を配置できるチャンスだワン！',
    'msg.hint.regionName': 'エリア {num}',
    'msg.toast.dog': 'マスをダブルタップ（Wクリック）で柴犬🐶を配置できるワン！',
    'msg.toast.cross': 'マスをタップまたはスライドで✕マークを配置できるワン！🐾',
    'msg.alert.jumpInvalid': '1 から 999,999 までのレベル番号を入力してくださいワン！',
    'msg.alert.resetConfirm': 'すべての進行状況を初期化しますか？この操作は元に戻せません。',
    'msg.alert.resetDone': '進捗データを初期化しましたワン！',

    // Rule Modal (modal-help)
    'rule.modal.title': '🐕 Shibadoku (柴独) の遊び方',
    'rule.lead': '「柴犬たちのパーソナルスペースを守ろう！」<br />数独のように論理で解く、癒やしのパズルゲームです。',
    'rule.card1.title': '各エリアに1匹',
    'rule.card1.desc': '色で分かれた各ドッグラン（エリア）に、柴犬（🐶）を<strong>ちょうど1匹</strong>配置します。',
    'rule.card2.title': '行と列に1匹ずつ',
    'rule.card2.desc': 'タテ1列、ヨコ1列につき、柴犬（🐶）は<strong>1匹だけ</strong>入ることができます。',
    'rule.card3.title': '触れ合いNG！（パーソナルスペース）',
    'rule.card3.desc': '柴犬同士は、<strong>縦・横・斜めの8方向すべてで隣り合ってはいけません</strong>。',
    'rule.card4.title': '仮置きマーク（？）',
    'rule.card4.desc': 'いくつかの配置パターンを試すメモとして使えます。<br /><strong>PC:</strong> 右クリック または <code>[N]</code> キー<br /><strong>スマホ:</strong> マスを長押し<br />※柴犬（🐶）や✕マークでそのまま上書きできます。',
    'rule.card5.title': 'かんたん操作',
    'rule.card5.desc': '<strong>クリック / タップ:</strong> ✕ マーク（柴犬が入れない場所）<br /><strong>ダブルクリック / ダブルタップ:</strong> 柴犬（🐶）を配置！<br /><strong>ドラッグ / スライド:</strong> 連続マーク＆Xマスからスライドで消去',
    'rule.btn.close': 'わかったワン！',

    // Controls Modal (modal-controls)
    'ctrl.modal.title': '🎮 操作ガイド',
    'ctrl.tab.pc': '💻 パソコン (PC)',
    'ctrl.tab.mobile': '📱 スマホ・タブレット',
    'ctrl.badge.current': '現在',
    'ctrl.pc.mouseTitle': '🖱️ マウス操作',
    'ctrl.pc.leftClick': '左シングルクリック',
    'ctrl.pc.leftClickDesc': '<strong>✕ マーク</strong> を配置 / 削除',
    'ctrl.pc.leftDrag': '左クリックドラッグ',
    'ctrl.pc.leftDragDesc': '複数のマスに連続で <strong>✕ マーク</strong> を記入（Xマスからドラッグで消去）',
    'ctrl.pc.doubleClick': '左ダブルクリック',
    'ctrl.pc.doubleClickDesc': '<strong>柴犬（🐶）</strong> を配置 / 削除',
    'ctrl.pc.rightClick': '右クリック',
    'ctrl.pc.rightClickDesc': '<strong>？ 仮置きマーク</strong> を配置 / 削除',
    'ctrl.pc.keyboardTitle': '⌨️ キーボード操作',
    'ctrl.pc.keyMove': '枠を移動',
    'ctrl.pc.keyDog': '<strong>柴犬（🐶）</strong>を配置',
    'ctrl.pc.keyCross': '<strong>✕ マーク</strong>を配置',
    'ctrl.pc.keyQuestion': '<strong>？ 仮置きマーク</strong>を配置',
    'ctrl.pc.keyUndo': '1手戻す（アンドゥ）',
    'ctrl.pc.keyHint': 'ヒントを見る',
    'ctrl.pc.keyEsc': 'タイトル画面に戻る',
    'ctrl.pc.tip': '💡 <strong>お役立ちヒント:</strong><br />・✕マークや？マークがあるマスでも、ダブルクリックやスペースキーで直接柴犬🐶を置けます（ミス判定にはなりません）。<br />・ドラッグで引いた連続✕マークも、戻すボタン（またはZキー）1回でまとめて元に戻せます。',

    'ctrl.mobile.touchTitle': '👆 タッチ操作',
    'ctrl.mobile.singleTap': 'シングルタップ',
    'ctrl.mobile.singleTapDesc': '<strong>✕ マーク</strong> を配置 / 削除',
    'ctrl.mobile.tapSlide': 'シングルタップスライド',
    'ctrl.mobile.tapSlideDesc': '指でなぞって一気に <strong>✕ マーク</strong> を連続記入（Xマスからスライドで消去）',
    'ctrl.mobile.doubleTap': 'ダブルタップ（素早く2回）',
    'ctrl.mobile.doubleTapDesc': '<strong>柴犬（🐶）</strong> を配置 / 削除',
    'ctrl.mobile.longPress': '長押し（約0.4秒）',
    'ctrl.mobile.longPressDesc': '<strong>？ 仮置きマーク</strong> を配置 / 削除<br /><small style="color: var(--color-text-muted);">（対応端末ならブルッと震えます）</small>',
    'ctrl.mobile.undo': 'もどすボタン',
    'ctrl.mobile.undoDesc': '間違えたときに1手前に戻せます（スライド記入も1手で復元）',
    'ctrl.mobile.tip': '💡 <strong>スマホで素早く解くコツ:</strong><br />・指でスライドして置けないマスを一気に塗りつぶし、確定マスをダブルタップで柴犬🐶にするのがおすすめ！<br />・✕マークがついているマスでも、ダブルタップすればそのまま柴犬🐶を置けます。',

    // Leaderboard Modal
    'lead.modal.title': '🏆 本日のデイリーランキング',
    'lead.user.name': 'あなた (柴犬マスター)',
    'lead.user.best': '今日のベストスコア: {score} 点',
    'lead.btn.play': '挑戦する 🐾',
    'lead.btn.close': 'とじる',

    // Stage Select Modal
    'stage.modal.title': '📋 レベル選択',
    'stage.jump.title': 'ステージ番号指定 (最大 Lv. 999,999)',
    'stage.jump.desc': '同じ番号なら誰がいつ遊んでも完全に同じパズルが生成されます！',
    'stage.jump.placeholder': 'レベル番号 (1〜999999)',
    'stage.jump.btn': '遊ぶ 🐾',
    'stage.random.title': '🎲 無限ランダムパズル',
    'stage.random.desc': '決まったレベル以外にも、毎回異なる唯一解パズルを自動生成して遊べます！',
    'stage.random.btn': '新しく生成',

    // Settings Modal
    'set.modal.title': '⚙️ ゲーム設定',
    'set.lang.name': '🌐 言語 (Language)',
    'set.lang.desc': '表示言語を切り替えます',
    'set.lang.auto': '自動 (Auto: 日本語)',
    'set.lang.ja': '日本語 (Japanese)',
    'set.lang.en': 'English (英語)',
    'set.shiba.name': '🐕 柴犬の種類',
    'set.shiba.desc': '盤面に登場する柴犬の毛色を選べます',
    'set.shiba.aka': '赤柴',
    'set.shiba.kuro': '黒柴',
    'set.shiba.shiro': '白柴',
    'set.sound.name': '🔊 効果音 (Sound)',
    'set.sound.desc': '柴犬の鳴き声やタップ音を再生',
    'set.automark.name': '⚡ 自動マーク (Auto-Mark)',
    'set.automark.desc': '柴犬配置時に置けないマスを自動で✕マーク',
    'set.reset.name': '🗑️ 進捗データ初期化',
    'set.reset.desc': 'クリアしたレベルやキャッシュを消去',
    'set.reset.btn': 'リセット',
    'set.btn.save': '設定を保存',

    // Victory Modal
    'win.modal.title': '🎉 レベルクリア！ 🎉',
    'win.modal.subtitle': 'すべての柴犬が仲良く過ごせる場所が見つかったワン！',
    'win.stat.time': 'クリアタイム',
    'win.stat.score': 'スコア',
    'win.btn.replay': 'もう一度',
    'win.btn.ranking': '🏆 順位を見る',
    'win.btn.next': '次のレベルへ 🐾',

    // Game Over Modal
    'gameover.modal.title': '🦴 骨がなくなっちゃったワン...',
    'gameover.modal.subtitle': '3回間違えてしまいました。最初からやり直してもう一度挑戦しよう！',
    'gameover.btn.home': 'タイトルへ',
    'gameover.btn.retry': 'もう一度やり直す 🐾',

    // Rank-Up Screen
    'rankup.title': 'ランキング',
    'rankup.continue': 'タップしてつづける',
  },

  en: {
    // App Meta
    'app.title': 'Shibadoku - Shiba Inu Logic Puzzle',
    'app.description': 'A soothing Zoodoku/Meowdoku style Shiba Inu logic puzzle game. Place 1 Shiba in each row, column, and color area without touching!',

    // Title Screen
    'title.logo': 'Shibadoku',
    'title.sublogo': 'Shibadoku',
    'title.tagline': "Shiba Inu Personal Space Logic Puzzle",
    'title.btn.play': 'Play (Level {level})',
    'title.btn.resume': 'Resume (Level {level}) 🐾',
    'title.btn.stages': 'Stages',
    'title.btn.ranking': 'Ranking',
    'title.btn.controls': 'Controls',
    'title.btn.rules': 'Rules',
    'title.btn.settings': 'Settings',
    'title.footer.cleared': 'Cleared: {completed} / {total}',

    // Gameplay Header & Subbar
    'game.header.home': 'Back to Home',
    'game.header.level': 'Level',
    'game.header.time': 'Time',
    'game.header.difficulty': 'Difficulty',
    'game.diff.beginner': 'Tutorial',
    'game.diff.easy': 'Easy',
    'game.diff.medium': 'Medium',
    'game.diff.hard': 'Hard',
    'game.diff.expert': 'Expert',
    'game.diff.master': 'Master',
    'game.header.controls': 'Controls',
    'game.header.ranking': 'Ranking',
    'game.header.settings': 'Settings',

    // Mini Rules Bar
    'game.minirule.tooltip': 'View Rules',
    'game.minirule.color': '1 per color area',
    'game.minirule.rowcol': '1 per row & col',
    'game.minirule.adjacent': 'No touching dogs',

    // Bottom Controls
    'game.btn.dog': 'Shiba (2x Tap)',
    'game.btn.mark': 'Cross (Tap)',
    'game.btn.hint': 'Hint',
    'game.btn.undo': 'Undo',
    'game.btn.automark': 'Auto-✕: ',
    'game.btn.reset': 'Reset',

    // In-game Alert / Flash Messages
    'msg.deny.row': 'Only 1 Shiba allowed per horizontal row, Woof!',
    'msg.deny.col': 'Only 1 Shiba allowed per vertical column, Woof!',
    'msg.deny.region': 'Only 1 Shiba allowed per color zone, Woof!',
    'msg.deny.adjacent': 'Shiba Inus are too close! No touching in all 8 directions, Woof!',
    'msg.deny.solution': "That's not where the Shiba belongs! (Incorrect cell)",
    'msg.hint.smooth': 'Looking good! Keep searching for empty color areas, Woof!',
    'msg.hint.conflict': 'This Shiba is conflicting with other dogs! Reconsider its placement, Woof.',
    'msg.hint.place': 'You can place a Shiba on row {row}, in {region}, Woof!',
    'msg.hint.regionName': 'Zone {num}',
    'msg.toast.dog': 'Double click or double tap to place a Shiba 🐶, Woof!',
    'msg.toast.cross': 'Click, tap, or drag to place a ✕ mark, Woof! 🐾',
    'msg.alert.jumpInvalid': 'Please enter a level number between 1 and 999,999, Woof!',
    'msg.alert.resetConfirm': 'Are you sure you want to reset all progress? This cannot be undone.',
    'msg.alert.resetDone': 'All game progress has been reset, Woof!',

    // Rule Modal (modal-help)
    'rule.modal.title': '🐕 How to Play Shibadoku',
    'rule.lead': "<strong>Protect each Shiba's personal space!</strong><br />A soothing logic puzzle to solve using pure deduction, like Sudoku.",
    'rule.card1.title': 'One per Color Area',
    'rule.card1.desc': 'Place <strong>exactly one</strong> Shiba Inu (🐶) in each colored dog park zone.',
    'rule.card2.title': 'One per Row & Column',
    'rule.card2.desc': 'Each row and each column can contain <strong>only one</strong> Shiba Inu (🐶).',
    'rule.card3.title': 'No Touching! (Personal Space)',
    'rule.card3.desc': 'Shiba Inus <strong>must never touch each other</strong> in all 8 directions (including diagonally).',
    'rule.card4.title': 'Pencil Marks (?)',
    'rule.card4.desc': 'Use notes to test placements.<br /><strong>PC:</strong> Right-click or press <code>[N]</code><br /><strong>Mobile:</strong> Long-press a cell<br />※ Can be directly overwritten by a Shiba (🐶) or ✕.',
    'rule.card5.title': 'Easy Controls',
    'rule.card5.desc': '<strong>Click / Tap:</strong> ✕ Mark (blocked spots)<br /><strong>Double Click / Tap:</strong> Place a Shiba (🐶)!<br /><strong>Drag / Slide:</strong> Draw continuous ✕ marks, or slide from ✕ to erase',
    'rule.btn.close': 'Got it, Woof!',

    // Controls Modal (modal-controls)
    'ctrl.modal.title': '🎮 Control Guide',
    'ctrl.tab.pc': '💻 Computer (PC)',
    'ctrl.tab.mobile': '📱 Mobile & Tablet',
    'ctrl.badge.current': 'Active',
    'ctrl.pc.mouseTitle': '🖱️ Mouse Controls',
    'ctrl.pc.leftClick': 'Left Single Click',
    'ctrl.pc.leftClickDesc': 'Place / Remove <strong>✕ Mark</strong>',
    'ctrl.pc.leftDrag': 'Left Click Drag',
    'ctrl.pc.leftDragDesc': 'Draw continuous <strong>✕ Marks</strong> (or slide from ✕ to erase)',
    'ctrl.pc.doubleClick': 'Left Double Click',
    'ctrl.pc.doubleClickDesc': 'Place / Remove <strong>Shiba (🐶)</strong>',
    'ctrl.pc.rightClick': 'Right Click',
    'ctrl.pc.rightClickDesc': 'Place / Remove <strong>? Note Mark</strong>',
    'ctrl.pc.keyboardTitle': '⌨️ Keyboard Shortcuts',
    'ctrl.pc.keyMove': 'Move cursor',
    'ctrl.pc.keyDog': 'Place <strong>Shiba (🐶)</strong>',
    'ctrl.pc.keyCross': 'Place <strong>✕ Mark</strong>',
    'ctrl.pc.keyQuestion': 'Place <strong>? Note Mark</strong>',
    'ctrl.pc.keyUndo': 'Undo move',
    'ctrl.pc.keyHint': 'Show hint',
    'ctrl.pc.keyEsc': 'Return to Title Screen',
    'ctrl.pc.tip': '💡 <strong>Pro Tips:</strong><br />• Even on cells with ✕ or ?, double-clicking or pressing Space directly places a Shiba 🐶 without penalty.<br />• Continuous ✕ marks drawn by dragging can be undone all at once with a single Undo (or Z key).',

    'ctrl.mobile.touchTitle': '👆 Touch Controls',
    'ctrl.mobile.singleTap': 'Single Tap',
    'ctrl.mobile.singleTapDesc': 'Place / Remove <strong>✕ Mark</strong>',
    'ctrl.mobile.tapSlide': 'Single Tap Slide',
    'ctrl.mobile.tapSlideDesc': 'Slide finger across to draw continuous <strong>✕ Marks</strong> (or slide from ✕ to erase)',
    'ctrl.mobile.doubleTap': 'Double Tap (Quick 2x)',
    'ctrl.mobile.doubleTapDesc': 'Place / Remove <strong>Shiba (🐶)</strong>',
    'ctrl.mobile.longPress': 'Long Press (~0.4s)',
    'ctrl.mobile.longPressDesc': 'Place / Remove <strong>? Note Mark</strong><br /><small style="color: var(--color-text-muted);">(Haptic vibration on supported devices)</small>',
    'ctrl.mobile.undo': 'Undo Button',
    'ctrl.mobile.undoDesc': 'Step back one move if you made a mistake (multi-cell slides restore in 1 step)',
    'ctrl.mobile.tip': '💡 <strong>Mobile Speed Tips:</strong><br />• Slide across blocked cells to quickly eliminate them, then double-tap the remaining cell to place a Shiba 🐶!<br />• You can directly double-tap a cell even if it has a ✕ mark on it.',

    // Leaderboard Modal
    'lead.modal.title': "🏆 Today's Daily Ranking",
    'lead.user.name': 'You (Shiba Master)',
    'lead.user.best': "Today's Best Score: {score} pts",
    'lead.btn.play': 'Challenge 🐾',
    'lead.btn.close': 'Close',

    // Stage Select Modal
    'stage.modal.title': '📋 Select Level',
    'stage.jump.title': 'Jump to Stage Number (up to Lv. 999,999)',
    'stage.jump.desc': 'Anyone who enters the same level number will play the exact same puzzle!',
    'stage.jump.placeholder': 'Level Number (1 - 999999)',
    'stage.jump.btn': 'Play 🐾',
    'stage.random.title': '🎲 Infinite Random Puzzle',
    'stage.random.desc': 'Generate brand new unique puzzles with guaranteed unique solutions anytime!',
    'stage.random.btn': 'Generate New',

    // Settings Modal
    'set.modal.title': '⚙️ Game Settings',
    'set.lang.name': '🌐 Language',
    'set.lang.desc': 'Change the display language',
    'set.lang.auto': 'Auto (System: English)',
    'set.lang.ja': '日本語 (Japanese)',
    'set.lang.en': 'English',
    'set.shiba.name': '🐕 Shiba Coat',
    'set.shiba.desc': 'Choose the Shiba Inu coat color for the puzzle',
    'set.shiba.aka': 'Red',
    'set.shiba.kuro': 'Black',
    'set.shiba.shiro': 'White',
    'set.sound.name': '🔊 Sound Effects',
    'set.sound.desc': 'Play bark & soothing tap sound effects',
    'set.automark.name': '⚡ Auto-Mark',
    'set.automark.desc': 'Auto-cross invalid spots when placing a Shiba',
    'set.reset.name': '🗑️ Reset Progress',
    'set.reset.desc': 'Clear completed levels and cached game state',
    'set.reset.btn': 'Reset',
    'set.btn.save': 'Save Settings',

    // Victory Modal
    'win.modal.title': '🎉 Level Complete! 🎉',
    'win.modal.subtitle': 'Every Shiba Inu has found their happy cozy personal space, Woof!',
    'win.stat.time': 'Clear Time',
    'win.stat.score': 'Score',
    'win.btn.replay': 'Play Again',
    'win.btn.ranking': '🏆 View Ranking',
    'win.btn.next': 'Next Level 🐾',

    // Game Over Modal
    'gameover.modal.title': '🦴 Out of treats, Woof...',
    'gameover.modal.subtitle': 'You made 3 mistakes! Take a breath, reset the board, and try again!',
    'gameover.btn.home': 'Home',
    'gameover.btn.retry': 'Try Again 🐾',

    // Rank-Up Screen
    'rankup.title': 'Tournament',
    'rankup.continue': 'Tap to continue',
  },
};

class I18nManager {
  private currentSetting: LangSetting = 'auto';
  private resolvedLang: SupportedLang = 'en';

  constructor() {
    this.resolvedLang = this.detectSystemLanguage();
  }

  /**
   * Detect language from browser environment:
   * Japanese if navigator.language starts with 'ja', otherwise English.
   */
  public detectSystemLanguage(): SupportedLang {
    if (typeof navigator !== 'undefined') {
      const languages = navigator.languages || [navigator.language];
      for (const lang of languages) {
        if (lang && lang.toLowerCase().startsWith('ja')) {
          return 'ja';
        }
      }
    }
    return 'en';
  }

  public setSetting(setting: LangSetting): void {
    this.currentSetting = setting;
    if (setting === 'auto') {
      this.resolvedLang = this.detectSystemLanguage();
    } else {
      this.resolvedLang = setting;
    }
  }

  public getSetting(): LangSetting {
    return this.currentSetting;
  }

  public getResolvedLang(): SupportedLang {
    return this.resolvedLang;
  }

  /**
   * Translate key with optional parameter interpolation {param}
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARY[this.resolvedLang] || DICTIONARY.en;
    let text = dict[key] || DICTIONARY.ja[key] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return text;
  }

  /**
   * Batch-apply translations to DOM elements with data-i18n attributes
   */
  public applyTranslations(root: HTMLElement | Document = document): void {
    // Update HTML lang attribute
    if (document.documentElement) {
      document.documentElement.lang = this.resolvedLang;
    }

    // Page title
    const metaTitle = this.t('app.title');
    if (metaTitle) {
      document.title = metaTitle;
    }

    // Elements with data-i18n (text content)
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Elements with data-i18n-html (HTML content)
    root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // Elements with data-i18n-title (title tooltip & aria-label)
    root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (key) {
        const text = this.t(key);
        el.title = text;
        if (el.hasAttribute('aria-label')) {
          el.setAttribute('aria-label', text);
        }
      }
    });

    // Elements with data-i18n-placeholder (input placeholder)
    root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (key) {
        el.placeholder = this.t(key);
      }
    });
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);

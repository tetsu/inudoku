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
    'msg.hint.empty': 'ヒントの残り回数が0回だワン！デイリーランキングで1位をとると、次の日にヒントが5回分増えるワン！🐾',
    'msg.rank.firstPlaceReached': '👑 デイリーランキング1位到達！この順位で一日が終わると、明日ヒントが5回分増えるワン！🐾',
    'msg.toast.dog': 'マスをダブルタップ（Wクリック）で柴犬🐶を配置できるワン！',
    'msg.toast.cross': 'マスをタップまたはスライドで✕マークを配置できるワン！🐾',
    'msg.alert.jumpInvalid': '1 から 999,999 までのレベル番号を入力してくださいワン！',
    'msg.alert.resetConfirm': 'すべての進行状況を初期化しますか？この操作は元に戻せません。',
    'msg.alert.resetDone': '進捗データを初期化しましたワン！',
    'msg.confirm.resetBoard': '盤面をリセットして最初からやり直しますか？',
    'dialog.title.confirm': '確認',
    'dialog.title.notice': 'お知らせ',
    'dialog.btn.ok': 'OK 🐾',
    'dialog.btn.cancel': 'キャンセル',

    // Daily Reward Modal
    'reward.modal.title': '🏆 前日1位達成ボーナス！',
    'reward.modal.subtitle': '昨日のデイリーランキングで見事1位を獲得したワン！おめでとう！',
    'reward.modal.bonus': '🎁 ボーナスとして ヒント +5回 を獲得しました！（現在のヒント: {count}回）',
    'reward.modal.desc': '✨ 新しい日が始まりました。今日も最下位から1位を目指して挑戦しよう！',
    'reward.modal.btn': '受け取って挑戦する 🐾',
    'reward.modal.claim': '受け取る 🐾',

    // Rule / Tutorial Modal (modal-help)
    'rule.modal.title': '🐕 Shibadoku (柴独) の遊び方',
    'rule.tab.area': '🎨 1. エリア',
    'rule.tab.line': '↔️ 2. タテ・ヨコ',
    'rule.tab.space': '🚫 3. 触れ合いNG',
    'rule.tab.controls': '👆 4. 操作',
    'rule.slide1.title': '各エリアに柴犬1匹',
    'rule.slide1.badgeA': 'エリアA: 🐶 1匹',
    'rule.slide1.badgeB': 'エリアB: 🐶 1匹',
    'rule.slide1.desc': '色で分かれた各ドッグラン（エリア）に、柴犬（🐶）を<strong>ちょうど1匹</strong>配置します。配置が決まったら残りのマスは ✕ で除外しましょう。',
    'rule.slide2.title': 'タテ・ヨコ列に1匹ずつ',
    'rule.slide2.badge': '同じ行・列の重複NG！',
    'rule.slide2.desc': 'タテ1列、ヨコ1列につき、柴犬（🐶）は<strong>1匹だけ</strong>入ることができます。柴犬を置くと、その列と行の他のマスはすべて ✕ になります。',
    'rule.slide3.title': '触れ合いNG！（パーソナルスペース）',
    'rule.slide3.ngTitle': '❌ 近すぎるワン！',
    'rule.slide3.ngDesc': 'ナナメも接触NG！💢',
    'rule.slide3.okTitle': '⭕ いい距離感だワン！',
    'rule.slide3.okDesc': '全8方向1マス空ける ✨',
    'rule.slide3.desc': '柴犬同士は<strong>タテ・ヨコ・ナナメの8方向すべて</strong>で隣り合ってはいけません。必ず最低1マス以上スペースを空けて配置します。',
    'rule.slide4.title': 'かんたん直感操作',
    'rule.slide4.tapTitle': '1タップ / クリック',
    'rule.slide4.tapDesc': '<strong>✕ マーク</strong>（入れない場所）',
    'rule.slide4.dtapTitle': 'ダブルタップ / ダブルクリック',
    'rule.slide4.dtapDesc': '<strong>柴犬 🐶 を配置！</strong>',
    'rule.slide4.slideTitle': 'スライド / なぞる',
    'rule.slide4.slideDesc': '<strong>連続 ✕ マーク</strong>（Xからなぞると消去）',
    'rule.slide4.holdTitle': '長押し / 右クリック',
    'rule.slide4.holdDesc': '<strong>❓ 仮置きメモ</strong>（柴犬や✕で上書き可）',
    'rule.slide4.desc': '空いているマスを<strong>ダブルタップ</strong>で柴犬配置！マスを<strong>なぞる（スライド）</strong>だけで連続で✕マークを引けます。',
    'rule.btn.prev': '前へ',
    'rule.btn.next': '次へ 🐾',
    'rule.btn.start': 'はじめるワン！ 🐾',
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
    'ctrl.pc.keyErase': 'マスを消去',
    'ctrl.pc.keyUndo': '1手戻す（アンドゥ）',
    'ctrl.pc.keyHint': 'ヒントを見る',
    'ctrl.pc.keyReset': '最初からやり直す',
    'ctrl.pc.keyMenu': 'メニュー・ダイアログの操作',
    'ctrl.pc.keyEsc': 'タイトル画面に戻る',
    'ctrl.pc.tip': '💡 <strong>お役立ちヒント:</strong><br />・キーボード操作時、メニューやダイアログは矢印キー/Tabキーで選択、Enter/Spaceキーで決定、Escキーで閉じることができます。<br />・✕マークや？マークがあるマスでも、スペースキーで直接柴犬🐶を置けます。',

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

    'ctrl.tab.gamepad': '🎮 コントローラー',
    'ctrl.gamepad.title': '🎮 コントローラー操作',
    'ctrl.gamepad.dpad': '十字キー / Lスティック',
    'ctrl.gamepad.dpadDesc': '枠を移動（長押しで高速移動）',
    'ctrl.gamepad.btnA': 'A ボタン',
    'ctrl.gamepad.btnADesc': '<strong>✕ マーク</strong> を配置 / 削除',
    'ctrl.gamepad.btnB': 'B ボタン',
    'ctrl.gamepad.btnBDesc': '<strong>柴犬（🐶）</strong> を配置 / 削除（メニューでは閉じる/キャンセル）',
    'ctrl.gamepad.btnX': 'X ボタン',
    'ctrl.gamepad.btnXDesc': '<strong>？ 仮置きマーク</strong> を配置 / 削除',
    'ctrl.gamepad.btnY': 'Y ボタン',
    'ctrl.gamepad.btnYDesc': 'マスを<strong>消去</strong>（クリア）',
    'ctrl.gamepad.shoulderL': 'LB / L1 / L2',
    'ctrl.gamepad.shoulderLDesc': '1手戻す（アンドゥ）',
    'ctrl.gamepad.shoulderR': 'RB / R1 / R2',
    'ctrl.gamepad.shoulderRDesc': 'ヒントを見る',
    'ctrl.gamepad.start': 'START / メニュー',
    'ctrl.gamepad.startDesc': 'クリア画面で次のステージへ / 設定を開く',
    'ctrl.gamepad.select': 'SELECT / 共有',
    'ctrl.gamepad.selectDesc': '操作ガイドを開く',
    'ctrl.gamepad.tip': '💡 <strong>コントローラーでの快適プレイ:</strong><br />・十字キーやLスティックを長押しすると連続でスムーズに移動できます。<br />・振動対応コントローラーでは、犬の配置やヒント使用時に心地よいハプティクスフィードバックがあります。<br />・Xbox、PlayStation、Nintendo Switch Proコンなどの一般的なゲームパッドに標準対応しています。',

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
    'set.username.name': '👤 ユーザーネーム',
    'set.username.desc': 'ランキング画面に表示されるあなたの名前',
    'set.username.placeholder': 'あなた (柴犬マスター)',
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
    'set.vibration.name': '📳 振動 (バイブレーション)',
    'set.vibration.desc': 'マーク配置時の触覚フィードバック（対応端末のみ）',
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
    'rankup.continue': 'タップ または [Enter / Space / 🎮 Aボタン] でつづける',
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
    'msg.hint.empty': 'No hints left, Woof! Finish in 1st place on the daily leaderboard to earn 5 hints tomorrow! 🐾',
    'msg.rank.firstPlaceReached': '👑 Reached 1st place! Finish today in 1st to earn +5 hints tomorrow, Woof! 🐾',
    'msg.toast.dog': 'Double click or double tap to place a Shiba 🐶, Woof!',
    'msg.toast.cross': 'Click, tap, or drag to place a ✕ mark, Woof! 🐾',
    'msg.alert.jumpInvalid': 'Please enter a level number between 1 and 999,999, Woof!',
    'msg.alert.resetConfirm': 'Are you sure you want to reset all progress? This cannot be undone.',
    'msg.alert.resetDone': 'All game progress has been reset, Woof!',
    'msg.confirm.resetBoard': 'Reset the board and start over?',
    'dialog.title.confirm': 'Confirm',
    'dialog.title.notice': 'Notice',
    'dialog.btn.ok': 'OK 🐾',
    'dialog.btn.cancel': 'Cancel',

    // Daily Reward Modal
    'reward.modal.title': '🏆 1st Place Daily Bonus!',
    'reward.modal.subtitle': "You finished in 1st place on yesterday's daily leaderboard! Congratulations!",
    'reward.modal.bonus': '🎁 You received +5 Hints as a reward! (Total hints: {count})',
    'reward.modal.desc': '✨ A new day has begun. Climb back to 1st place from the bottom today!',
    'reward.modal.btn': 'Claim & Play 🐾',
    'reward.modal.claim': 'Claim 🐾',

    // Rule / Tutorial Modal (modal-help)
    'rule.modal.title': '🐕 How to Play Shibadoku',
    'rule.tab.area': '🎨 1. Areas',
    'rule.tab.line': '↔️ 2. Lines',
    'rule.tab.space': '🚫 3. Distance',
    'rule.tab.controls': '👆 4. Controls',
    'rule.slide1.title': 'One Shiba per Color Area',
    'rule.slide1.badgeA': 'Area A: 🐶 1 Shiba',
    'rule.slide1.badgeB': 'Area B: 🐶 1 Shiba',
    'rule.slide1.desc': 'Place <strong>exactly one</strong> Shiba (🐶) in each colored dog park zone. Once placed, all other cells in that zone are crossed out with ✕.',
    'rule.slide2.title': 'One Shiba per Row & Column',
    'rule.slide2.badge': 'No duplicate lines!',
    'rule.slide2.desc': 'Each row and column can contain <strong>only one</strong> Shiba (🐶). Placing a Shiba eliminates other cells in that same row and column with ✕.',
    'rule.slide3.title': 'No Touching! (Personal Space)',
    'rule.slide3.ngTitle': '❌ Too Close!',
    'rule.slide3.ngDesc': 'Diagonals touch! 💢',
    'rule.slide3.okTitle': '⭕ Good Distance!',
    'rule.slide3.okDesc': '1+ cell space all around ✨',
    'rule.slide3.desc': 'Shibas <strong>must never touch each other in all 8 directions</strong> (including diagonally). Always leave at least one empty cell between them.',
    'rule.slide4.title': 'Intuitive Controls',
    'rule.slide4.tapTitle': '1 Tap / Click',
    'rule.slide4.tapDesc': '<strong>✕ Mark</strong> (blocked spot)',
    'rule.slide4.dtapTitle': 'Double Tap / Click',
    'rule.slide4.dtapDesc': '<strong>Place Shiba 🐶!</strong>',
    'rule.slide4.slideTitle': 'Slide / Drag',
    'rule.slide4.slideDesc': '<strong>Draw continuous ✕</strong> (slide from ✕ to erase)',
    'rule.slide4.holdTitle': 'Long Press / Right Click',
    'rule.slide4.holdDesc': '<strong>❓ Tentative Note</strong> (overwrite anytime)',
    'rule.slide4.desc': '<strong>Double-tap</strong> any cell to place a Shiba! Simply <strong>slide</strong> across cells to quickly draw continuous ✕ marks.',
    'rule.btn.prev': 'Back',
    'rule.btn.next': 'Next 🐾',
    'rule.btn.start': 'Start Playing! 🐾',
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
    'ctrl.pc.keyErase': 'Erase Cell',
    'ctrl.pc.keyUndo': 'Undo move',
    'ctrl.pc.keyHint': 'Show hint',
    'ctrl.pc.keyReset': 'Restart Level',
    'ctrl.pc.keyMenu': 'Navigate Menus & Modals',
    'ctrl.pc.keyEsc': 'Return to Title Screen',
    'ctrl.pc.tip': '💡 <strong>Pro Tips:</strong><br />• You can navigate all menus and dialogs using Arrow keys or Tab, select with Enter/Space, and close with Esc.<br />• Even on cells with ✕ or ?, pressing Space directly places a Shiba 🐶 without penalty.',

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

    'ctrl.tab.gamepad': '🎮 Gamepad',
    'ctrl.gamepad.title': '🎮 Gamepad Controls',
    'ctrl.gamepad.dpad': 'D-Pad / Left Stick',
    'ctrl.gamepad.dpadDesc': 'Move cursor (Hold to move quickly)',
    'ctrl.gamepad.btnA': 'A Button',
    'ctrl.gamepad.btnADesc': 'Place / Remove <strong>✕ Mark</strong>',
    'ctrl.gamepad.btnB': 'B Button',
    'ctrl.gamepad.btnBDesc': 'Place / Remove <strong>Shiba (🐶)</strong> (Cancel / Close in menus)',
    'ctrl.gamepad.btnX': 'X Button',
    'ctrl.gamepad.btnXDesc': 'Place / Remove <strong>? Note Mark</strong>',
    'ctrl.gamepad.btnY': 'Y Button',
    'ctrl.gamepad.btnYDesc': '<strong>Erase</strong> / Clear cell',
    'ctrl.gamepad.shoulderL': 'LB / L1 / L2',
    'ctrl.gamepad.shoulderLDesc': 'Undo last move',
    'ctrl.gamepad.shoulderR': 'RB / R1 / R2',
    'ctrl.gamepad.shoulderRDesc': 'Show hint',
    'ctrl.gamepad.start': 'START / Menu',
    'ctrl.gamepad.startDesc': 'Next stage on victory / Open settings',
    'ctrl.gamepad.select': 'SELECT / Share',
    'ctrl.gamepad.selectDesc': 'Open control guide',
    'ctrl.gamepad.tip': '💡 <strong>Controller Tips:</strong><br />• Hold D-Pad or Left Stick for fast, smooth cursor movement across the grid.<br />• Supported gamepads provide haptic rumble feedback for moves, mistakes, and hints.<br />• Standard support for Xbox, PlayStation (DualShock / DualSense), and Switch Pro controllers.',

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
    'set.username.name': '👤 Username',
    'set.username.desc': 'Your display name shown on ranking screens',
    'set.username.placeholder': 'You (Shiba Master)',
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
    'set.vibration.name': '📳 Vibration',
    'set.vibration.desc': 'Haptic vibration feedback when marking (supported devices only)',
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
    'rankup.continue': 'Tap or press [Enter / Space / 🎮 A] to continue',
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

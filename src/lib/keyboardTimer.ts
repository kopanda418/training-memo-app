/**
 * キーボード表示中に出す浮動タイマーボタン(features/timer/KeyboardTimerButton)の位置計算。
 * DOM に触れない純粋関数だけを置き、テストで挙動を固定する。
 *
 * 【なぜ画面座標を使わないか(v1.0.20)】
 * iOS では position: fixed の基準(レイアウトビューポート)と実際に見えている領域
 * (visualViewport)の対応が場面ごとに食い違い、visualViewport.height / offsetTop から
 * 「画面の下端」を逆算する方法が実機で破綻した(入力欄が画面上部なら正常、中程では
 * キーボードの裏、下部では画面外へ飛ぶ)。
 * そこで基準を画面ではなく **フォーカス中の入力欄** に変えた。iOS は必ず入力欄が
 * 見える位置までスクロールするので、その真上に置けば場面によらず見える。
 * 座標はすべてスクロールコンテナ(main)のコンテンツ座標で統一し、同じ
 * getBoundingClientRect 同士の引き算だけで求める(ビューポートの解釈に依存しない)。
 */

/** これ未満のキーボード高さは、アドレスバー伸縮などのノイズとみなして無視する */
export const KEYBOARD_THRESHOLD = 100

/** 入力欄とボタンの間隔 px */
export const GAP = 8

/** ボタンの高さ px(CSS の h-10 と一致させること) */
export const BUTTON_HEIGHT = 40

export interface ViewportMetrics {
  /** window.innerHeight */
  innerHeight: number
  /** visualViewport.height */
  viewportHeight: number
}

/** キーボード高さ。offsetTop は混ぜないこと(混ぜると自動スクロール中に閾値を割って一瞬で消える) */
export function keyboardHeight(m: ViewportMetrics): number {
  return Math.max(0, m.innerHeight - m.viewportHeight)
}

/** ボタンを出すか(= ソフトキーボードが開いているか) */
export function isKeyboardOpen(m: ViewportMetrics): boolean {
  return keyboardHeight(m) > KEYBOARD_THRESHOLD
}

export interface AnchorMetrics {
  /** フォーカス中の入力欄の上端(main のコンテンツ座標) */
  inputTop: number
  /** 同・下端 */
  inputBottom: number
  /** main.scrollTop = 可視領域の上端のコンテンツ座標 */
  scrollTop: number
}

/**
 * ボタンの top(main のコンテンツ座標 = position: absolute の値)。
 * 原則は入力欄の真上。上に置くと可視領域の外(上)へ出てしまう場合だけ真下へ回す
 * (入力欄が可視領域の一番上にある場合 = その下は必ず見えている)。
 */
export function anchoredTop(m: AnchorMetrics): number {
  const above = m.inputTop - BUTTON_HEIGHT - GAP
  return above >= m.scrollTop + GAP ? above : m.inputBottom + GAP
}

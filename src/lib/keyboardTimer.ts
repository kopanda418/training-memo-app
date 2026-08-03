/**
 * キーボード表示中に出す浮動タイマーボタン(features/timer/KeyboardTimerButton)の計算。
 * DOM に触れない純粋関数だけを置き、テストで挙動を固定する。
 *
 * 【表示条件にキーボード高さを使わない理由(v1.0.21)】
 * 実機では画面下側の入力欄にフォーカスした場面で `innerHeight - visualViewport.height` が
 * 閾値を割り、ボタンが描画されなくなっていた(位置を入力欄基準にしても「消える」症状が
 * 残ったことから、位置ではなく表示条件側の問題と判明)。
 * 表示は「テキスト入力欄にフォーカスがあるか」で決め、キーボード高さは位置決めにだけ使う。
 */

/** 非タッチ環境(PC)でのみ使う保険の閾値。これ未満のキーボード高さはノイズとみなす */
export const KEYBOARD_THRESHOLD = 100

/** キーボード上端からの余白 px */
export const GAP = 8

export interface ViewportMetrics {
  /** window.innerHeight */
  innerHeight: number
  /** visualViewport.height */
  viewportHeight: number
}

/**
 * キーボード高さ。
 * offsetTop は混ぜないこと(自動スクロール中に値が縮んでボタンが暴れる。v1.0.10/v1.0.19 の教訓)。
 */
export function keyboardHeight(m: ViewportMetrics): number {
  return Math.max(0, m.innerHeight - m.viewportHeight)
}

/** PC 等でキーボードが無いのにボタンを出さないための保険 */
export function isKeyboardOpen(m: ViewportMetrics): boolean {
  return keyboardHeight(m) > KEYBOARD_THRESHOLD
}

/**
 * position: fixed の bottom 値 = キーボードの上端 + 余白。
 *
 * iOS には「キーボード分だけ visualViewport だけが縮む」場面と
 * 「レイアウトビューポート(innerHeight)ごと縮む」場面があるが、後者では
 * キーボード高さが 0 になるため、この式はどちらでも画面下端(=キーボード上端)に合う。
 */
export function floatingBottom(m: ViewportMetrics): number {
  return keyboardHeight(m) + GAP
}

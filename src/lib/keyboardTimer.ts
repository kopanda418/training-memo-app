/**
 * キーボード直上に浮かせるボタン(features/timer/KeyboardTimerButton)の位置計算。
 * DOM に触れない純粋関数だけを置き、テストで挙動を固定する。
 *
 * 用語(iOS のビューポートは 2 種類ある):
 * - レイアウトビューポート = window.innerHeight。position: fixed が基準にする座標系
 * - ビジュアルビューポート = visualViewport。キーボードを除いた「実際に見えている窓」。
 *   iOS は下側の入力欄を見せるためにこの窓をページ上で下へずらす(そのずれ量が offsetTop)
 */

/** これ未満のキーボード高さは、アドレスバー伸縮などのノイズとみなして無視する */
export const KEYBOARD_THRESHOLD = 100

/** 可視領域の下端(=キーボード上端)からの余白 px */
export const FLOAT_MARGIN = 8

export interface ViewportMetrics {
  /** window.innerHeight (H) */
  innerHeight: number
  /** visualViewport.height (V) */
  viewportHeight: number
  /** visualViewport.offsetTop (T) */
  offsetTop: number
}

/** キーボード高さ K = H - V。offsetTop は混ぜないこと(下の isKeyboardOpen 参照) */
export function keyboardHeight(m: ViewportMetrics): number {
  return Math.max(0, m.innerHeight - m.viewportHeight)
}

/**
 * ボタンを出すか。判定には offsetTop を **使わない**。
 * 混ぜると iOS の自動スクロール中に値が閾値を割り、ボタンが unmount して一瞬で消える(v1.0.10 の不具合)。
 */
export function isKeyboardOpen(m: ViewportMetrics): boolean {
  return keyboardHeight(m) > KEYBOARD_THRESHOLD
}

/**
 * position: fixed の bottom 値。
 *
 * fixed の基準はレイアウトビューポートなので、bottom = K + margin だとページ座標の
 * 「V - margin」に置かれる。一方いま見えている範囲はページ座標で [T, T + V] なので、
 * 画面上の位置は V - margin - T となり、T が大きいほどボタンが上へ飛び、
 * T > V - margin で画面外(上)へ消える。T は入力欄が画面下側にあるほど大きくなるため、
 * 「下の欄にフォーカスすると出ない」という症状になっていた(v1.0.19 で修正)。
 * よって位置計算では T を必ず差し引く。
 *
 * 下限 FLOAT_MARGIN は、キーボード開閉アニメーション中に一時的に T > K となった場合に
 * 負値でボタンが画面下へ落ちるのを防ぐ保険。
 */
export function floatingBottom(m: ViewportMetrics): number {
  return Math.max(FLOAT_MARGIN, keyboardHeight(m) + FLOAT_MARGIN - Math.max(0, m.offsetTop))
}

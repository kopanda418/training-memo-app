/**
 * iOS スタンドアロン PWA のビューポート短縮バグ補正。
 * 環境(Web クリップの状態や iOS バージョン)によって、レイアウトビューポートが
 * ステータスバー分短く上端固定される場合(→補正が必要)と、正しく下端に届く場合
 * (→補正するとタブバーが画面外に出る)の両方が確認されたため、
 * デフォルトは補正なしとし、設定画面から切り替えられるようにする。
 */

const STORAGE_KEY = 'bottomGapMode'

export type BottomGapMode = 'off' | 'auto'

export function getBottomGapMode(): BottomGapMode {
  return localStorage.getItem(STORAGE_KEY) === 'auto' ? 'auto' : 'off'
}

export function setBottomGapMode(mode: BottomGapMode) {
  localStorage.setItem(STORAGE_KEY, mode)
  updateViewportGap()
}

/** 補正量の候補(実測値)。診断表示にも使う */
export function measureGapCandidate(): number {
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!standalone) return 0
  const missing = screen.height - window.innerHeight
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat'))
  if (missing > 0 && Number.isFinite(safeTop) && safeTop > 0) {
    return Math.min(missing, safeTop)
  }
  return 0
}

export function updateViewportGap() {
  const gap = getBottomGapMode() === 'auto' ? measureGapCandidate() : 0
  document.documentElement.style.setProperty('--bottom-gap', `${gap}px`)
}

export function installViewportFix() {
  updateViewportGap()
  window.addEventListener('resize', () => setTimeout(updateViewportGap, 50))
  window.addEventListener('orientationchange', () => setTimeout(updateViewportGap, 300))
}

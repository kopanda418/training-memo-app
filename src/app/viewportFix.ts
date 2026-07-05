/**
 * iOS スタンドアロン PWA のビューポート短縮バグ補正。
 * 環境によって必要な補正量が異なる(0 のことも、ステータスバー高より小さいこともある)ため、
 * 補正量はユーザーが設定画面のスライダーで実際の見た目を確認しながら決める方式にする。
 * 値は px 単位で localStorage に保存(0 = 補正なし、デフォルト)。
 */

const STORAGE_KEY = 'bottomGapPx'
export const MAX_BOTTOM_GAP = 80

export function getBottomGapPx(): number {
  const n = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_BOTTOM_GAP) : 0
}

export function setBottomGapPx(px: number) {
  const clamped = Math.min(Math.max(Math.round(px), 0), MAX_BOTTOM_GAP)
  localStorage.setItem(STORAGE_KEY, String(clamped))
  applyBottomGap()
}

/** 参考値: ビューポート短縮の実測量(この値が補正の目安になる) */
export function measureGapCandidate(): number {
  const missing = screen.height - window.innerHeight
  return missing > 0 ? missing : 0
}

function applyBottomGap() {
  document.documentElement.style.setProperty('--bottom-gap', `${getBottomGapPx()}px`)
}

export function installViewportFix() {
  applyBottomGap()
}

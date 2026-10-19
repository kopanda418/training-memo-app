import type { Choice } from './painRegions'

// ---- 睡眠時間・生活負荷(ADR-020) ----

/**
 * 生活負荷のコード。保存データのキーなので変更・削除はせず、追加のみ行う
 * (例: 将来「体調不良」を足す)
 */
export const STRESSORS: Choice[] = [
  { id: 'childcare', label: '育児' },
  { id: 'work', label: '仕事' },
]

/** 睡眠時間の選択肢(時間、0.5 刻み)。3 = 3 時間以下、10 = 10 時間以上 */
export const SLEEP_HOURS: number[] = Array.from({ length: 15 }, (_, i) => 3 + i * 0.5)

export const sleepLabel = (h: number): string =>
  h <= 3 ? '〜3' : h >= 10 ? '10〜' : Number.isInteger(h) ? String(h) : h.toFixed(1)

/**
 * 負荷のチップを切り替える。undefined = 記録なし、[] = 負荷なし(明示)。
 * 全部外したら記録なしに戻す(「なし」は明示のタップでだけ付く)
 */
export function toggleStressor(current: string[] | undefined, id: string): string[] | undefined {
  const list = current ?? []
  const next = list.includes(id) ? list.filter((s) => s !== id) : [...list, id]
  return next.length ? next : undefined
}

/** 「なし」チップ。負荷なし([])にする。既に負荷なしなら記録なしに戻す */
export const toggleNoStressor = (current: string[] | undefined): string[] | undefined =>
  current && current.length === 0 ? undefined : []

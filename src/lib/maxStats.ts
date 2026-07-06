import type { WorkoutSet } from '../db/types'
import { estimateOneRepMax } from './oneRepMax'
import { effectiveLoad } from './setFormat'

/** ベスト値と、それを最初に達成した日・そのセットの内容 */
export interface BestEntry {
  value: number
  /** 最古の達成日(同値なら最初に達成した日を保持) */
  date: string
  /** そのセットの実効負荷 */
  load: number
  /** そのセットの実績レップ */
  reps: number
}

export interface MaxRow {
  exerciseId: string
  tagId: string
  load: BestEntry
  reps: BestEntry
  oneRm: BestEntry
  /** 最終実施日(ウォームアップ・実績空欄除く) */
  lastDate: string
}

/**
 * 種目×タグごとの MAX(重量 / 回数 / 推定1RM)。
 * それぞれ独立のベスト(回数ベストは重量に関係なく最大レップ)。
 * ウォームアップ・実績空欄・換算不能な自重は除外。
 */
export function computeMaxRows(sets: WorkoutSet[], bodyWeight?: number): MaxRow[] {
  // 日付昇順に走査し「より大きい値」のときだけ更新する = 同値なら最古の達成日が残る
  const sorted = [...sets].sort((a, b) =>
    a.date === b.date ? a.orderInDay - b.orderInDay : a.date.localeCompare(b.date),
  )
  const map = new Map<string, MaxRow>()
  for (const s of sorted) {
    if (s.isWarmup || s.reps <= 0) continue
    const load = effectiveLoad(s, bodyWeight)
    if (load === undefined || load <= 0) continue
    const key = `${s.exerciseId}|${s.tagId}`
    let row = map.get(key)
    if (!row) {
      const zero: BestEntry = { value: 0, date: s.date, load: 0, reps: 0 }
      row = {
        exerciseId: s.exerciseId,
        tagId: s.tagId,
        load: zero,
        reps: zero,
        oneRm: zero,
        lastDate: s.date,
      }
      map.set(key, row)
    }
    const entry: BestEntry = { value: 0, date: s.date, load, reps: s.reps }
    if (load > row.load.value) row.load = { ...entry, value: load }
    if (s.reps > row.reps.value) row.reps = { ...entry, value: s.reps }
    const rm = estimateOneRepMax(load, s.reps)
    if (rm > row.oneRm.value) row.oneRm = { ...entry, value: rm }
    if (s.date > row.lastDate) row.lastDate = s.date
  }
  return [...map.values()]
}

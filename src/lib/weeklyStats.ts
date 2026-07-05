import type { WorkoutSet } from '../db/types'
import { effectiveLoad } from './setFormat'

export interface WeeklyStats {
  /** 有効セット数(ウォームアップ・実績空欄を除く) */
  sets: number
  /** ボリュームロード = Σ(実効負荷 × 実績レップ)。体重未登録の自重セットは含まない */
  volume: number
  /** ボリュームから除外された自重セット数(体重未登録のため換算不能) */
  excludedBodyweight: number
  /** 種目 ID ごとの内訳 */
  byExercise: Map<string, { sets: number; volume: number }>
}

/**
 * 週間集計。ノイズ除去ルール:
 * - ウォームアップセットは除外
 * - 実績レップ空欄(0)は除外
 * - 自重セットは体重登録時のみ「体重+加重」でボリューム計上(未登録はセット数のみ計上し件数を注記)
 */
export function computeWeeklyStats(sets: WorkoutSet[], bodyWeight?: number): WeeklyStats {
  const stats: WeeklyStats = { sets: 0, volume: 0, excludedBodyweight: 0, byExercise: new Map() }
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0) continue
    let entry = stats.byExercise.get(s.exerciseId)
    if (!entry) {
      entry = { sets: 0, volume: 0 }
      stats.byExercise.set(s.exerciseId, entry)
    }
    stats.sets++
    entry.sets++
    const load = effectiveLoad(s, bodyWeight)
    if (load === undefined) {
      stats.excludedBodyweight++
      continue
    }
    const v = load * s.reps
    stats.volume += v
    entry.volume += v
  }
  return stats
}

/** 日付キーのセット群を週開始日(月曜)ごとにまとめる */
export function bucketByWeekStart(
  sets: WorkoutSet[],
  weekStartOf: (date: string) => string,
): Map<string, WorkoutSet[]> {
  const map = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    const key = weekStartOf(s.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return map
}

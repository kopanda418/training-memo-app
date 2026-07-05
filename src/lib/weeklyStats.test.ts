import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../db/types'
import { computeWeeklyStats } from './weeklyStats'

function makeSet(partial: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    date: '2026-07-06',
    exerciseId: 'ex1',
    tagId: '',
    weight: 100,
    reps: 5,
    isAssisted: false,
    unit: 'kg',
    orderInDay: 0,
    createdAt: 0,
    ...partial,
  }
}

describe('computeWeeklyStats', () => {
  it('ウォームアップと実績空欄はセット数・ボリュームとも除外', () => {
    const stats = computeWeeklyStats([
      makeSet({ weight: 100, reps: 5 }), // 500
      makeSet({ weight: 40, reps: 10, isWarmup: true }), // 除外
      makeSet({ weight: 100, reps: 0 }), // 実績空欄 → 除外
      makeSet({ exerciseId: 'ex2', weight: 50, reps: 10 }), // 500
    ])
    expect(stats.sets).toBe(2)
    expect(stats.volume).toBe(1000)
    expect(stats.byExercise.get('ex1')).toEqual({ sets: 1, volume: 500 })
    expect(stats.byExercise.get('ex2')).toEqual({ sets: 1, volume: 500 })
  })

  it('自重セット: 体重登録時は体重+加重で計上、未登録はセット数のみ+除外件数', () => {
    const sets = [
      makeSet({ weight: 10, reps: 6, isBodyweight: true }),
      makeSet({ weight: 100, reps: 5 }),
    ]
    const withBw = computeWeeklyStats(sets, 65)
    expect(withBw.sets).toBe(2)
    expect(withBw.volume).toBe(75 * 6 + 500)
    expect(withBw.excludedBodyweight).toBe(0)

    const noBw = computeWeeklyStats(sets)
    expect(noBw.sets).toBe(2) // セット数には数える
    expect(noBw.volume).toBe(500) // ボリュームからは除外
    expect(noBw.excludedBodyweight).toBe(1)
  })
})

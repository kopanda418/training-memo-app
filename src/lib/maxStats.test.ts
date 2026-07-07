import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../db/types'
import { computeMaxRows } from './maxStats'

function makeSet(partial: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    date: '2026-07-01',
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

describe('computeMaxRows', () => {
  it('重量・回数・推定1RM は独立のベストで、それぞれ達成セットの内容を持つ', () => {
    const rows = computeMaxRows([
      makeSet({ date: '2026-06-01', weight: 60, reps: 12 }), // 回数ベスト
      makeSet({ date: '2026-06-10', weight: 105, reps: 1 }), // 重量ベスト
      makeSet({ date: '2026-06-20', weight: 100, reps: 4 }), // 1RMベスト(113.3)
    ])
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.load).toMatchObject({ value: 105, date: '2026-06-10', reps: 1 })
    expect(row.reps).toMatchObject({ value: 12, date: '2026-06-01', load: 60 })
    expect(Math.round(row.oneRm.value * 10) / 10).toBe(113.3)
    expect(row.oneRm.date).toBe('2026-06-20')
    // 更新日 = 3 指標の達成日のうち最新(1RM を最後に更新した 6/20)
    expect(row.updatedDate).toBe('2026-06-20')
  })

  it('同値は最古の達成日を保持し、ウォームアップ・実績空欄は除外', () => {
    const rows = computeMaxRows([
      makeSet({ date: '2026-06-01', weight: 100, reps: 5 }),
      makeSet({ date: '2026-06-15', weight: 100, reps: 5 }), // 同値 → 6/1 が残る
      makeSet({ date: '2026-06-20', weight: 200, reps: 1, isWarmup: true }), // 除外
      makeSet({ date: '2026-06-21', weight: 300, reps: 0 }), // 実績空欄 → 除外
    ])
    expect(rows[0].load).toMatchObject({ value: 100, date: '2026-06-01' })
    expect(rows[0].reps).toMatchObject({ value: 5, date: '2026-06-01' })
  })
})

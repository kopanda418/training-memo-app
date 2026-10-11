import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../db/types'
import { makeBodyWeightOf, parseBodyWeight } from './bodyWeight'
import { computeMaxRows } from './maxStats'
import { computeWeeklyStats } from './weeklyStats'

const entries = [
  { date: '2026-10-05', weight: 70.25 },
  { date: '2026-10-01', weight: 71.5 },
]

describe('makeBodyWeightOf', () => {
  it('その日の記録 → 直近過去の記録 → 設定値 の順に使う', () => {
    const of = makeBodyWeightOf(entries, 65)
    expect(of('2026-10-05')).toBe(70.25)
    expect(of('2026-10-03')).toBe(71.5)
    expect(of('2026-10-10')).toBe(70.25)
    expect(of('2026-09-30')).toBe(65)
  })

  it('記録も設定も無ければ undefined', () => {
    expect(makeBodyWeightOf([])('2026-10-01')).toBeUndefined()
  })
})

describe('parseBodyWeight', () => {
  it('小数第二位に丸め、不正値は undefined', () => {
    expect(parseBodyWeight('65.256')).toBe(65.26)
    expect(parseBodyWeight(' 70.1 ')).toBe(70.1)
    expect(parseBodyWeight('')).toBeUndefined()
    expect(parseBodyWeight('abc')).toBeUndefined()
    expect(parseBodyWeight('0')).toBeUndefined()
  })
})

describe('自重セットの換算に日ごとの体重を使う', () => {
  const set = (date: string): WorkoutSet => ({
    id: crypto.randomUUID(),
    date,
    exerciseId: 'chin',
    tagId: '',
    weight: 10,
    reps: 5,
    isAssisted: false,
    isBodyweight: true,
    unit: 'kg',
    orderInDay: 0,
    createdAt: 0,
  })

  it('週間集計は各セットの日の体重 + 加重で計上する', () => {
    const of = makeBodyWeightOf(entries)
    const stats = computeWeeklyStats([set('2026-10-02'), set('2026-10-06')], of)
    expect(stats.volume).toBeCloseTo((71.5 + 10) * 5 + (70.25 + 10) * 5)
    expect(stats.excludedBodyweight).toBe(0)
  })

  it('MAX の重量ベストも日ごとの体重で判定する', () => {
    const of = makeBodyWeightOf(entries)
    const [row] = computeMaxRows([set('2026-10-02'), set('2026-10-06')], of)
    expect(row.load.value).toBe(81.5)
    expect(row.load.date).toBe('2026-10-02')
  })
})

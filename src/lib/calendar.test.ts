import { describe, expect, it } from 'vitest'
import { addMonths, monthGrid } from './calendar'

describe('monthGrid', () => {
  it('2026年7月: 水曜始まりの月が正しく並ぶ', () => {
    const weeks = monthGrid(2026, 7)
    expect(weeks[0][3]).toEqual({ date: '2026-07-01', inMonth: true }) // 7/1 は水曜
    expect(weeks[0][0]).toEqual({ date: '2026-06-28', inMonth: false })
    const flat = weeks.flat()
    expect(flat.filter((c) => c.inMonth)).toHaveLength(31)
    expect(flat.length % 7).toBe(0)
  })

  it('うるう年の 2 月を含む', () => {
    const flat = monthGrid(2028, 2).flat()
    expect(flat.filter((c) => c.inMonth)).toHaveLength(29)
  })

  it('翌月だけの週は含まれない', () => {
    for (const [y, m] of [
      [2026, 7],
      [2026, 2],
      [2027, 1],
    ]) {
      const weeks = monthGrid(y, m)
      expect(weeks[weeks.length - 1].some((c) => c.inMonth)).toBe(true)
    }
  })
})

describe('addMonths', () => {
  it('年をまたいで加減算できる', () => {
    expect(addMonths(2026, 7, 1)).toEqual([2026, 8])
    expect(addMonths(2026, 12, 1)).toEqual([2027, 1])
    expect(addMonths(2026, 1, -1)).toEqual([2025, 12])
  })
})

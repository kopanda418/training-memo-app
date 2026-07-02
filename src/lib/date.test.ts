import { describe, expect, it } from 'vitest'
import { addDays, formatDateLabel, toDateString } from './date'

describe('toDateString', () => {
  it('ゼロ埋めした YYYY-MM-DD を返す', () => {
    expect(toDateString(new Date(2026, 6, 3))).toBe('2026-07-03')
    expect(toDateString(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('addDays', () => {
  it('月末・年末をまたいで加減算できる', () => {
    expect(addDays('2026-07-03', 1)).toBe('2026-07-04')
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('formatDateLabel', () => {
  it('月/日(曜) 形式で返す', () => {
    // 2026-07-03 は金曜
    expect(formatDateLabel('2026-07-03')).toMatch(/^(2026\/)?7\/3\(金\)$/)
  })
  it('別の年なら年を付ける', () => {
    expect(formatDateLabel('2020-01-05')).toBe('2020/1/5(日)')
  })
})

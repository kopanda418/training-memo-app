import { describe, expect, it } from 'vitest'
import { addWeeks, formatWeekLabel, weekEnd, weekStart } from './week'

describe('weekStart(月曜始まり)', () => {
  it('各曜日からその週の月曜を返す', () => {
    expect(weekStart('2026-07-06')).toBe('2026-07-06') // 月
    expect(weekStart('2026-07-05')).toBe('2026-06-29') // 日 → 前週月曜
    expect(weekStart('2026-07-04')).toBe('2026-06-29') // 土
    expect(weekStart('2026-07-08')).toBe('2026-07-06') // 水
  })
})

describe('addWeeks / weekEnd / formatWeekLabel', () => {
  it('週の加減算とラベル', () => {
    expect(addWeeks('2026-07-06', -1)).toBe('2026-06-29')
    expect(weekEnd('2026-06-29')).toBe('2026-07-05')
    expect(formatWeekLabel('2026-06-29')).toBe('6/29〜7/5')
  })
})

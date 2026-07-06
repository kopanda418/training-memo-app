import { describe, expect, it } from 'vitest'
import { formatTimerSeconds } from './timerFormat'

describe('formatTimerSeconds', () => {
  it('m:ss 形式で返す', () => {
    expect(formatTimerSeconds(0)).toBe('0:00')
    expect(formatTimerSeconds(9)).toBe('0:09')
    expect(formatTimerSeconds(90)).toBe('1:30')
    expect(formatTimerSeconds(600)).toBe('10:00')
    expect(formatTimerSeconds(-5)).toBe('0:00')
  })
})

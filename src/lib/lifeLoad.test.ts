import { describe, expect, it } from 'vitest'
import { SLEEP_HOURS, sleepLabel, toggleNoStressor, toggleStressor } from './lifeLoad'

describe('睡眠時間の選択肢 (ADR-020)', () => {
  it('3〜10 時間を 0.5 刻みで持ち、両端は「〜3」「10〜」と表示する', () => {
    expect(SLEEP_HOURS).toHaveLength(15)
    expect(SLEEP_HOURS[0]).toBe(3)
    expect(SLEEP_HOURS.at(-1)).toBe(10)
    expect(SLEEP_HOURS.map(sleepLabel).slice(0, 3)).toEqual(['〜3', '3.5', '4'])
    expect(sleepLabel(10)).toBe('10〜')
  })
})

describe('生活負荷の切り替え (ADR-020)', () => {
  it('負荷を付け外しし、全部外すと記録なし(undefined)に戻る', () => {
    expect(toggleStressor(undefined, 'childcare')).toEqual(['childcare'])
    expect(toggleStressor(['childcare'], 'work')).toEqual(['childcare', 'work'])
    expect(toggleStressor(['childcare'], 'childcare')).toBeUndefined()
  })

  it('負荷なし([])の状態で負荷を付けると「なし」は外れる', () => {
    expect(toggleStressor([], 'work')).toEqual(['work'])
  })

  it('「なし」は負荷を全部外して [] にし、もう一度で記録なしに戻る', () => {
    expect(toggleNoStressor(undefined)).toEqual([])
    expect(toggleNoStressor(['childcare', 'work'])).toEqual([])
    expect(toggleNoStressor([])).toBeUndefined()
  })
})

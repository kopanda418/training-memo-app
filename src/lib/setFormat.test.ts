import { describe, expect, it } from 'vitest'
import { effectiveLoad, formatSetWeight } from './setFormat'

describe('formatSetWeight', () => {
  it('通常セット・純自重・加重自重を表示し分ける', () => {
    expect(formatSetWeight({ weight: 100, unit: 'kg' })).toBe('100kg')
    expect(formatSetWeight({ weight: 0, unit: 'kg', isBodyweight: true })).toBe('自重')
    expect(formatSetWeight({ weight: 10, unit: 'kg', isBodyweight: true })).toBe('自重+10kg')
  })
})

describe('effectiveLoad', () => {
  it('自重セットは体重+加重、体重未登録なら undefined', () => {
    expect(effectiveLoad({ weight: 100, unit: 'kg' })).toBe(100)
    expect(effectiveLoad({ weight: 10, unit: 'kg', isBodyweight: true }, 65)).toBe(75)
    expect(effectiveLoad({ weight: 0, unit: 'kg', isBodyweight: true }, 65)).toBe(65)
    expect(effectiveLoad({ weight: 10, unit: 'kg', isBodyweight: true })).toBeUndefined()
    expect(effectiveLoad({ weight: 10, unit: 'kg', isBodyweight: true }, 0)).toBeUndefined()
  })
})

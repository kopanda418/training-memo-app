import { describe, expect, it } from 'vitest'
import { estimateOneRepMax } from './oneRepMax'

describe('estimateOneRepMax', () => {
  it('1 レップは重量そのまま', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
  })

  it('Epley 式で計算する (100kg x 10 → 133.3kg)', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.33, 1)
  })

  it('不正な入力は 0', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0)
    expect(estimateOneRepMax(100, 0)).toBe(0)
    expect(estimateOneRepMax(-10, 5)).toBe(0)
  })
})

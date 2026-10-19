import { describe, expect, it } from 'vitest'
import { cycleSideAttributes, isSideAttribute, sideOf } from './setSide'

describe('setSide(ADR-018)', () => {
  it('無 → 右 → 左 → 無 の順に切り替わる', () => {
    const r = cycleSideAttributes(undefined)
    expect(r).toEqual(['右'])
    const l = cycleSideAttributes(r)
    expect(l).toEqual(['左'])
    expect(cycleSideAttributes(l)).toBeUndefined()
  })

  it('左右以外の属性は残す', () => {
    expect(cycleSideAttributes(['フル'])).toEqual(['フル', '右'])
    expect(cycleSideAttributes(['右', 'フル'])).toEqual(['フル', '左'])
    expect(cycleSideAttributes(['フル', '左'])).toEqual(['フル'])
  })

  it('両方付いた古いデータは右として扱い、次で左だけにする', () => {
    expect(sideOf(['左', '右'])).toBe('右')
    expect(cycleSideAttributes(['左', '右'])).toEqual(['左'])
  })

  it('左右の属性名を判定する', () => {
    expect(isSideAttribute('右')).toBe(true)
    expect(isSideAttribute(' 左 ')).toBe(true)
    expect(isSideAttribute('フル')).toBe(false)
  })
})

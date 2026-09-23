import { describe, expect, it } from 'vitest'
import { PAIN_AREAS, isHeadacheWarning, regionLabel, sideOptions } from './painRegions'

describe('painRegions', () => {
  it('部位・細部の ID が重複しない(保存データのキーのため)', () => {
    const areaIds = PAIN_AREAS.map((a) => a.id)
    const regionIds = PAIN_AREAS.flatMap((a) => a.regions.map((r) => r.id))
    expect(new Set(areaIds).size).toBe(areaIds.length)
    expect(new Set(regionIds).size).toBe(regionIds.length)
  })

  it('頭は中央/左右/両側を選べ、場所の区分がある', () => {
    expect(sideOptions('head')).toEqual(['C', 'R', 'L', 'B'])
    expect(regionLabel('head.temporal')).toBe('こめかみ(側頭部)')
  })

  it('突然の頭痛・強い頭痛だけ受診の注意を出す', () => {
    expect(isHeadacheWarning('head', 3, 'sudden')).toBe(true)
    expect(isHeadacheWarning('head', 8, 'gradual')).toBe(true)
    expect(isHeadacheWarning('head', 5, 'gradual')).toBe(false)
    expect(isHeadacheWarning('knee', 9, 'sudden')).toBe(false)
  })
})

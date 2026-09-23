import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildPainSummary } from '../lib/painSummary'
import { exportData, importData } from './backup'
import {
  getCondition,
  listOngoingPains,
  listPainGroups,
  listPainsByDate,
  savePain,
  setConditionScore,
  type PainInput,
} from './condition'
import { db } from './db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const pain = (over: Partial<PainInput>): PainInput => ({
  date: '2026-09-20',
  area: 'knee',
  regionIds: ['knee.medial'],
  side: 'R',
  intensity: 4,
  qualities: ['sharp'],
  timings: ['training'],
  movements: ['squat'],
  exerciseIds: [],
  ...over,
})

describe('setConditionScore', () => {
  it('体調・やる気を個別に保存し、両方解除すると行が消える', async () => {
    await setConditionScore('2026-09-20', 'condition', 7)
    await setConditionScore('2026-09-20', 'motivation', 9)
    expect(await getCondition('2026-09-20')).toEqual({
      date: '2026-09-20',
      condition: 7,
      motivation: 9,
    })
    await setConditionScore('2026-09-20', 'condition', undefined)
    await setConditionScore('2026-09-20', 'motivation', undefined)
    expect(await getCondition('2026-09-20')).toBeUndefined()
  })

  it('日レコード(days)を作らない(ホームジムの既定場所判定に影響させない)', async () => {
    await setConditionScore('2026-09-20', 'condition', 5)
    expect(await db.days.count()).toBe(0)
  })
})

describe('savePain', () => {
  it('同じ日×部位×左右は 1 件にまとまり、左右が違えば別件', async () => {
    await savePain(pain({ intensity: 3 }))
    await savePain(pain({ intensity: 6, regionIds: ['knee.medial', 'knee.posterior'] }))
    await savePain(pain({ side: 'L' }))
    const rows = await listPainsByDate('2026-09-20')
    expect(rows).toHaveLength(2)
    const right = rows.find((r) => r.side === 'R')!
    expect(right.intensity).toBe(6)
    expect(right.regionIds).toEqual(['knee.medial', 'knee.posterior'])
  })
})

describe('savePain(編集で左右を変更)', () => {
  it('変更先に同じ日の記録があれば編集側に一本化される', async () => {
    const right = await savePain(pain({ side: 'R', intensity: 5 }))
    await savePain(pain({ side: 'L', intensity: 2 }))
    await savePain({ ...right, side: 'L' })
    const rows = await listPainsByDate('2026-09-20')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: right.id, side: 'L', intensity: 5 })
  })
})

describe('listOngoingPains', () => {
  it('14 日以内で最後の強さが 1 以上、今日まだ記録していない痛みだけ返す', async () => {
    await savePain(pain({ date: '2026-09-10', area: 'knee', side: 'R', intensity: 5 }))
    await savePain(pain({ date: '2026-09-18', area: 'knee', side: 'R', intensity: 3 }))
    // 最後が 0 = 治った
    await savePain(pain({ date: '2026-09-12', area: 'elbow', side: 'L', intensity: 4 }))
    await savePain(pain({ date: '2026-09-15', area: 'elbow', side: 'L', intensity: 0 }))
    // 古すぎる
    await savePain(pain({ date: '2026-08-01', area: 'shoulder', side: 'R', intensity: 6 }))
    // 今日すでに記録済み
    await savePain(pain({ date: '2026-09-19', area: 'lowBack', side: 'C', intensity: 2 }))
    await savePain(pain({ date: '2026-09-20', area: 'lowBack', side: 'C', intensity: 2 }))

    const ongoing = await listOngoingPains('2026-09-20')
    expect(ongoing.map((p) => [p.area, p.side, p.date])).toEqual([['knee', 'R', '2026-09-18']])
  })
})

describe('listPainGroups / buildPainSummary', () => {
  it('部位×左右ごとに古い順でまとめ、受診用の要約を作れる', async () => {
    const [squat] = await db.exercises.toArray()
    await savePain(pain({ date: '2026-09-01', intensity: 6, onset: 'gradual' }))
    await savePain(pain({ date: '2026-09-08', intensity: 3, exerciseIds: [squat.id] }))
    await savePain(pain({ date: '2026-09-05', area: 'elbow', side: 'L', regionIds: [] }))

    const groups = await listPainGroups()
    expect(groups.map((g) => `${g.area}|${g.side}`)).toEqual(['knee|R', 'elbow|L'])
    expect(groups[0].records.map((r) => r.date)).toEqual(['2026-09-01', '2026-09-08'])

    const text = buildPainSummary(groups[0].records, () => 'スクワット')
    expect(text).toContain('【右 膝】')
    expect(text).toContain('記録期間: 2026/9/1〜2026/9/8(2回)')
    expect(text).toContain('最新 3 / 最大 6 / 初回 6')
    expect(text).toContain('始まり方: だんだん')
    expect(text).toContain('場所: 内側(2回)')
    expect(text).toContain('関連しそうな種目: スクワット')
  })
})

describe('バックアップ', () => {
  it('体調と痛みがエクスポート → インポートで復元される', async () => {
    await setConditionScore('2026-09-20', 'condition', 8)
    await savePain(pain({ note: '階段で痛い' }))
    const backup = await exportData()
    await db.delete()
    await db.open()
    await importData(JSON.parse(JSON.stringify(backup)))
    expect((await getCondition('2026-09-20'))?.condition).toBe(8)
    expect((await listPainsByDate('2026-09-20'))[0].note).toBe('階段で痛い')
  })
})

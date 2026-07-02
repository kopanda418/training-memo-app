import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addSet,
  deleteSet,
  getDay,
  listHistory,
  listLocations,
  listSetsByDate,
  setDayLocation,
  updateSet,
} from './repository'
import { NO_TAG } from './types'

beforeEach(async () => {
  // テストごとに DB を作り直す(populate も再実行される)
  await db.delete()
  await db.open()
})

describe('デフォルトマスタの投入', () => {
  it('初回オープン時に種目とタグが入っている', async () => {
    expect(await db.exercises.count()).toBeGreaterThan(20)
    const tags = await db.tags.orderBy('sortOrder').toArray()
    expect(tags.map((t) => t.name)).toEqual(['高重量日', '中重量日', '低重量日'])
  })
})

describe('addSet / listSetsByDate', () => {
  it('セット追加で日レコードが作られ、orderInDay が連番になる', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-03', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-03', exerciseId: ex.id, weight: 105, reps: 3 })

    const sets = await listSetsByDate('2026-07-03')
    expect(sets.map((s) => s.orderInDay)).toEqual([0, 1])
    expect(sets[0].tagId).toBe(NO_TAG)
    expect(sets[0].unit).toBe('kg')
    expect(await getDay('2026-07-03')).toBeDefined()
  })
})

describe('listHistory(種目×タグ)', () => {
  it('同じ種目でもタグが違えば別の履歴になる', async () => {
    const ex = (await db.exercises.toArray())[0]
    const [heavy] = await db.tags.toArray()

    await addSet({ date: '2026-07-01', exerciseId: ex.id, tagId: heavy.id, weight: 120, reps: 3 })
    await addSet({ date: '2026-07-02', exerciseId: ex.id, weight: 80, reps: 10 })
    await addSet({ date: '2026-07-03', exerciseId: ex.id, tagId: heavy.id, weight: 125, reps: 2 })

    const heavyHistory = await listHistory(ex.id, heavy.id)
    expect(heavyHistory.map((s) => s.weight)).toEqual([125, 120]) // 日付降順
    const noTagHistory = await listHistory(ex.id)
    expect(noTagHistory.map((s) => s.weight)).toEqual([80])
  })
})

describe('updateSet / deleteSet', () => {
  it('更新と削除ができる', async () => {
    const ex = (await db.exercises.toArray())[0]
    const set = await addSet({ date: '2026-07-03', exerciseId: ex.id, weight: 100, reps: 5 })

    await updateSet(set.id, { weight: 102.5, memo: '調子よし' })
    const updated = await db.sets.get(set.id)
    expect(updated?.weight).toBe(102.5)
    expect(updated?.memo).toBe('調子よし')

    await deleteSet(set.id)
    expect(await db.sets.get(set.id)).toBeUndefined()
  })
})

describe('setDayLocation / listLocations', () => {
  it('新規の場所は作成され、同名は再利用される', async () => {
    await setDayLocation('2026-07-01', 'ゴールドジム 渋谷')
    await setDayLocation('2026-07-02', 'ゴールドジム 渋谷')
    await setDayLocation('2026-07-03', '市民体育館')

    expect(await db.locations.count()).toBe(2)
    const day1 = await getDay('2026-07-01')
    const day2 = await getDay('2026-07-02')
    expect(day1?.locationId).toBe(day2?.locationId)

    // 最近使った順
    const candidates = await listLocations()
    expect(candidates[0].name).toBe('市民体育館')
  })

  it('空文字で場所設定を解除できる', async () => {
    await setDayLocation('2026-07-03', 'ジム')
    await setDayLocation('2026-07-03', '')
    expect((await getDay('2026-07-03'))?.locationId).toBeUndefined()
  })
})

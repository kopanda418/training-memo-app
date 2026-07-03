import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addSet,
  addTag,
  copyPreviousSession,
  deleteSet,
  getDay,
  getLastSet,
  listHistory,
  listLocations,
  listRecordedDates,
  listSetsByDate,
  setDayLocation,
  transferSets,
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

describe('getLastSet', () => {
  it('種目×タグの直近セットを返す(同日なら orderInDay が最後のもの)', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 90, reps: 8 })
    await addSet({ date: '2026-07-02', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-02', exerciseId: ex.id, weight: 105, reps: 3 })

    expect((await getLastSet(ex.id))?.weight).toBe(105)
    expect((await getLastSet(ex.id, undefined, '2026-07-01'))?.weight).toBe(90)
    expect(await getLastSet('missing-id')).toBeUndefined()
  })
})

describe('copyPreviousSession(前回コピー)', () => {
  it('前回の日の全セットを対象日の末尾にコピーする', async () => {
    const ex = (await db.exercises.toArray())[0]
    const ex2 = (await db.exercises.toArray())[1]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 4 })
    // 別種目・後日の記録は無関係
    await addSet({ date: '2026-07-02', exerciseId: ex2.id, weight: 50, reps: 10 })
    await addSet({ date: '2026-07-03', exerciseId: ex2.id, weight: 50, reps: 10 })

    const copied = await copyPreviousSession('2026-07-03', ex.id)
    expect(copied).toBe(2)

    const sets = await listSetsByDate('2026-07-03')
    expect(sets).toHaveLength(3)
    expect(sets.map((s) => s.orderInDay)).toEqual([0, 1, 2])
    expect(sets[1].weight).toBe(100)
    expect(sets[1].reps).toBe(5)
  })

  it('前回記録がなければ 0 を返して何もしない', async () => {
    const ex = (await db.exercises.toArray())[0]
    expect(await copyPreviousSession('2026-07-03', ex.id)).toBe(0)
    expect(await listSetsByDate('2026-07-03')).toHaveLength(0)
  })
})

describe('listRecordedDates', () => {
  it('期間内でセットがある日付だけを返す', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-15', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-08-01', exerciseId: ex.id, weight: 100, reps: 5 })
    await setDayLocation('2026-07-20', 'ジム') // セットのない日はマークしない

    const dates = await listRecordedDates('2026-07-01', '2026-07-31')
    expect(dates.sort()).toEqual(['2026-07-01', '2026-07-15'])
  })
})

describe('transferSets(日付間コピー/移動)', () => {
  it('日全体のコピー: 元の日は残り、対象日の末尾に複製される', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 105, reps: 3 })
    await addSet({ date: '2026-07-05', exerciseId: ex.id, weight: 60, reps: 12 })

    const n = await transferSets({ fromDate: '2026-07-01', toDate: '2026-07-05', mode: 'copy' })
    expect(n).toBe(2)
    expect(await listSetsByDate('2026-07-01')).toHaveLength(2)
    const target = await listSetsByDate('2026-07-05')
    expect(target.map((s) => s.weight)).toEqual([60, 100, 105])
    expect(target.map((s) => s.orderInDay)).toEqual([0, 1, 2])
  })

  it('日全体の移動: 元の日が空になり days レコードも消える', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })

    const n = await transferSets({ fromDate: '2026-07-01', toDate: '2026-07-02', mode: 'move' })
    expect(n).toBe(1)
    expect(await listSetsByDate('2026-07-01')).toHaveLength(0)
    expect(await getDay('2026-07-01')).toBeUndefined()
    expect(await listSetsByDate('2026-07-02')).toHaveLength(1)
    expect(await getDay('2026-07-02')).toBeDefined()
  })

  it('種目×タグ単位の移動: 対象ブロックだけ動き、他は残る', async () => {
    const [ex, ex2] = await db.exercises.toArray()
    const [heavy] = await db.tags.toArray()
    await addSet({ date: '2026-07-01', exerciseId: ex.id, tagId: heavy.id, weight: 120, reps: 3 })
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 80, reps: 10 }) // 同種目タグなし
    await addSet({ date: '2026-07-01', exerciseId: ex2.id, weight: 50, reps: 10 })

    const n = await transferSets({
      fromDate: '2026-07-01',
      toDate: '2026-07-02',
      mode: 'move',
      exerciseId: ex.id,
      tagId: heavy.id,
    })
    expect(n).toBe(1)
    const remaining = await listSetsByDate('2026-07-01')
    expect(remaining).toHaveLength(2)
    expect(await getDay('2026-07-01')).toBeDefined() // まだセットが残るので日は消えない
    expect((await listSetsByDate('2026-07-02'))[0].weight).toBe(120)
  })

  it('同じ日への転送と空の転送は 0 を返す', async () => {
    const ex = (await db.exercises.toArray())[0]
    await addSet({ date: '2026-07-01', exerciseId: ex.id, weight: 100, reps: 5 })
    expect(await transferSets({ fromDate: '2026-07-01', toDate: '2026-07-01', mode: 'copy' })).toBe(
      0,
    )
    expect(await transferSets({ fromDate: '2026-07-09', toDate: '2026-07-10', mode: 'move' })).toBe(
      0,
    )
  })
})

describe('addTag', () => {
  it('新規タグは連番 sortOrder で追加され、同名は再利用される', async () => {
    const created = await addTag('リハビリ')
    expect(created.sortOrder).toBe(3) // デフォルト3種の後ろ
    const again = await addTag(' リハビリ ')
    expect(again.id).toBe(created.id)
    expect(await db.tags.count()).toBe(4)
  })
})

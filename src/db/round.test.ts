import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { groupSetsIntoBlocks, roundLabels } from '../lib/groupSets'
import type { PlanImportFile } from '../lib/planImport'
import { TrainingMemoDB, db } from './db'
import { applyPlanImport } from './planImport'
import {
  addSet,
  applyTemplate,
  copyPreviousSession,
  deleteBlockInDay,
  getBlockNote,
  listSetsByDate,
  saveTemplateFromDay,
  setBlockNote,
  transferSets,
} from './repository'
import { NO_TAG } from './types'

/** 同じ種目を他の種目を挟んで行ったときの「回目」(ADR-015) */

const B = (exerciseId: string, tagId: string = NO_TAG, round = 0) => ({ exerciseId, tagId, round })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const summary = async (date: string) =>
  groupSetsIntoBlocks(await listSetsByDate(date)).map((b) => [b.exerciseId, b.round, b.sets.length])

describe('回目ごとのブロック', () => {
  it('ベンチ2 → カール3 → ベンチ3 を実施順の 3 ブロックとして記録できる', async () => {
    const [bench, curl] = await db.exercises.toArray()
    const d = '2026-10-10'
    for (let i = 0; i < 2; i++) await addSet({ date: d, exerciseId: bench.id, weight: 80, reps: 5 })
    for (let i = 0; i < 3; i++) await addSet({ date: d, exerciseId: curl.id, weight: 12, reps: 10 })
    for (let i = 0; i < 3; i++)
      await addSet({ date: d, exerciseId: bench.id, weight: 70, reps: 8, round: 1 })

    const blocks = groupSetsIntoBlocks(await listSetsByDate(d))
    expect(blocks.map((b) => [b.exerciseId, b.round, b.sets.length])).toEqual([
      [bench.id, 0, 2],
      [curl.id, 0, 3],
      [bench.id, 1, 3],
    ])
    expect(roundLabels(blocks)).toEqual(['1回目', undefined, '2回目'])

    // 1 回目にセットを足しても 1 回目のブロックに入る(2 回目と混ざらない)
    await addSet({ date: d, exerciseId: bench.id, weight: 80, reps: 4 })
    expect(await summary(d)).toEqual([
      [bench.id, 0, 3],
      [curl.id, 0, 3],
      [bench.id, 1, 3],
    ])
  })

  it('種目メモは回目ごとに別々で、削除も回目単位', async () => {
    const [bench] = await db.exercises.toArray()
    const d = '2026-10-10'
    await addSet({ date: d, exerciseId: bench.id, weight: 80, reps: 5 })
    await addSet({ date: d, exerciseId: bench.id, weight: 70, reps: 8, round: 1 })
    await setBlockNote(d, B(bench.id), '1回目メモ')
    await setBlockNote(d, B(bench.id, NO_TAG, 1), '2回目メモ')
    expect((await getBlockNote(d, B(bench.id)))?.note).toBe('1回目メモ')
    expect((await getBlockNote(d, B(bench.id, NO_TAG, 1)))?.note).toBe('2回目メモ')

    expect(await deleteBlockInDay(d, B(bench.id, NO_TAG, 1))).toBe(1)
    expect(await summary(d)).toEqual([[bench.id, 0, 1]])
    expect((await getBlockNote(d, B(bench.id)))?.note).toBe('1回目メモ')
    expect(await getBlockNote(d, B(bench.id, NO_TAG, 1))).toBeUndefined()
  })

  it('別の日へ移動しても、行き先の同じ種目と合流せず別の回目になる(メモも追従)', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: '2026-10-01', exerciseId: bench.id, weight: 80, reps: 5 })
    await setBlockNote('2026-10-01', B(bench.id), '移動するメモ')
    await addSet({ date: '2026-10-02', exerciseId: bench.id, weight: 60, reps: 10 })
    await addSet({ date: '2026-10-02', exerciseId: curl.id, weight: 12, reps: 10 })

    await transferSets({
      fromDate: '2026-10-01',
      toDate: '2026-10-02',
      mode: 'move',
      block: B(bench.id),
    })
    expect(await summary('2026-10-02')).toEqual([
      [bench.id, 0, 1],
      [curl.id, 0, 1],
      [bench.id, 1, 1],
    ])
    expect((await getBlockNote('2026-10-02', B(bench.id, NO_TAG, 1)))?.note).toBe('移動するメモ')
  })

  it('前回コピーは前回の同じ回目を、無ければ最初のブロックをコピーする', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: '2026-10-01', exerciseId: bench.id, weight: 80, reps: 5 })
    await addSet({ date: '2026-10-01', exerciseId: curl.id, weight: 12, reps: 10 })
    await addSet({ date: '2026-10-01', exerciseId: bench.id, weight: 60, reps: 12, round: 1 })

    await copyPreviousSession('2026-10-08', bench.id, NO_TAG, { round: 1 })
    let sets = await listSetsByDate('2026-10-08')
    expect(sets.map((s) => [s.weight, s.round ?? 0])).toEqual([[60, 1]])

    await copyPreviousSession('2026-10-05', bench.id, NO_TAG, { round: 2 })
    sets = await listSetsByDate('2026-10-05')
    expect(sets.map((s) => [s.weight, s.round ?? 0])).toEqual([[80, 2]])
  })

  it('テンプレートに同じ種目が 2 回あれば、展開時も別の回目になる', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: '2026-10-01', exerciseId: bench.id, weight: 80, reps: 5 })
    await addSet({ date: '2026-10-01', exerciseId: curl.id, weight: 12, reps: 10 })
    await addSet({ date: '2026-10-01', exerciseId: bench.id, weight: 60, reps: 12, round: 1 })
    const template = await saveTemplateFromDay('2026-10-01', '胸腕')
    expect(template.items).toHaveLength(3)

    await applyTemplate('2026-10-08', template.id)
    expect(await summary('2026-10-08')).toEqual([
      [bench.id, 0, 1],
      [curl.id, 0, 1],
      [bench.id, 1, 1],
    ])
  })
})

describe('プラン取り込みの実施順', () => {
  const planFile = (days: PlanImportFile['days']): PlanImportFile => ({
    app: 'training-memo-app',
    kind: 'plan-import',
    formatVersion: 1,
    days,
  })

  it('items の並び順どおりに取り込み、同じ種目の 2 つ目は別の回目になる。再取り込みはスキップ', async () => {
    const [bench, curl] = await db.exercises.toArray()
    const file = planFile([
      {
        date: '2026-10-14',
        items: [
          { exercise: bench.name, note: '1回目の指示', sets: [{ weight: 80 }, { weight: 80 }] },
          { exercise: curl.name, sets: [{ weight: 12 }] },
          { exercise: bench.name, note: '2回目の指示', sets: [{ weight: 60 }] },
        ],
      },
    ])
    const result = await applyPlanImport(file)
    expect(result.addBlocks.map((b) => b.round)).toEqual([0, 0, 1])
    expect(await summary('2026-10-14')).toEqual([
      [bench.id, 0, 2],
      [curl.id, 0, 1],
      [bench.id, 1, 1],
    ])
    expect((await getBlockNote('2026-10-14', B(bench.id, NO_TAG, 1)))?.planNote).toBe('2回目の指示')

    const again = await applyPlanImport(file)
    expect(again.addBlocks).toEqual([])
    expect(again.skipBlocks.map((b) => b.round)).toEqual([0, 0, 1])
  })

  it('上書き取り込みは元のブロックの位置に置き換わる', async () => {
    const [bench, curl] = await db.exercises.toArray()
    const items = (benchWeight: number) => [
      { exercise: bench.name, sets: [{ weight: benchWeight }] },
      { exercise: curl.name, sets: [{ weight: 12 }] },
      { exercise: bench.name, sets: [{ weight: 60 }] },
    ]
    await applyPlanImport(planFile([{ date: '2026-10-14', items: items(80) }]))
    await applyPlanImport(planFile([{ date: '2026-10-14', items: items(85) }]), {
      overwrite: true,
    })
    const sets = await listSetsByDate('2026-10-14')
    expect(sets.map((s) => [s.exerciseId, s.weight, s.round ?? 0])).toEqual([
      [bench.id, 85, 0],
      [curl.id, 12, 0],
      [bench.id, 60, 1],
    ])
    expect(sets.map((s) => s.orderInDay)).toEqual([0, 1, 2])
  })
})

describe('DB 移行(v8 → v10)', () => {
  it('旧 blockNotes の行は blockNotesV2 へ round: 0 で移る', async () => {
    db.close()
    await Dexie.delete('training-memo')
    const old = new Dexie('training-memo')
    old.version(8).stores({
      exercises: 'id, name, bodyPart, sortOrder',
      tags: 'id, name, sortOrder',
      days: 'date',
      sets: 'id, date, [exerciseId+tagId], exerciseId',
      locations: 'id, name',
      settings: 'key',
      setAttributes: 'id, name',
      bodyParts: 'id, name, sortOrder',
      templates: 'id, name',
      blockNotes: '[date+exerciseId+tagId], date',
      conditions: 'date',
      painRecords: 'id, date, area, [area+side]',
    })
    await old.open()
    await old.table('blockNotes').add({
      date: '2026-07-01',
      exerciseId: 'ex',
      tagId: NO_TAG,
      note: '旧メモ',
      planNote: '指示',
    })
    old.close()

    const upgraded = new TrainingMemoDB()
    await upgraded.open()
    expect(await upgraded.blockNotes.toArray()).toEqual([
      {
        date: '2026-07-01',
        exerciseId: 'ex',
        tagId: NO_TAG,
        round: 0,
        note: '旧メモ',
        planNote: '指示',
      },
    ])
    expect(upgraded.tables.map((t) => t.name)).not.toContain('blockNotes')
    upgraded.close()
    await db.open()
  })
})

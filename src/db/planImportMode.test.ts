import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PlanImportFile } from '../lib/planImport'
import { db } from './db'
import { applyPlanImport, previewPlanImport } from './planImport'
import { addSet, getBlockNote, listSetsByDate, setBlockNote, updateSet } from './repository'
import { NO_TAG } from './types'

/** プラン取り込みの 3 つの上書き方法(ADR-016) */

const B = (exerciseId: string, tagId: string = NO_TAG, round = 0) => ({ exerciseId, tagId, round })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const planFile = (days: PlanImportFile['days']): PlanImportFile => ({
  app: 'training-memo-app',
  kind: 'plan-import',
  formatVersion: 1,
  days,
})

const D = '2026-10-14'

/** 旧プラン: ベンチ → カール → スクワット。新プラン: カール → ベンチ(スクワットは不採用) */
async function setup() {
  const [bench, curl, squat] = await db.exercises.toArray()
  await applyPlanImport(
    planFile([
      {
        date: D,
        items: [
          { exercise: bench.name, note: '旧ベンチ指示', sets: [{ weight: 80 }, { weight: 80 }] },
          { exercise: curl.name, sets: [{ weight: 12 }] },
          { exercise: squat.name, sets: [{ weight: 100 }] },
        ],
      },
    ]),
  )
  const newPlan = planFile([
    {
      date: D,
      location: '新しいジム',
      items: [
        { exercise: curl.name, sets: [{ weight: 14 }] },
        { exercise: bench.name, note: '新ベンチ指示', sets: [{ weight: 85 }, { weight: 85 }] },
      ],
    },
  ])
  return { bench, curl, squat, newPlan }
}

const summary = async () =>
  (await listSetsByDate(D)).map((s) => [s.exerciseId, s.weight, s.orderInDay])

describe('プラン取り込みの上書き方法', () => {
  it('上書きしない: 既存はそのまま、重複はスキップ', async () => {
    const { bench, curl, squat, newPlan } = await setup()
    const result = await applyPlanImport(newPlan, { mode: 'skip' })
    expect(result.skipBlocks).toHaveLength(2)
    expect(result.removeBlocks).toEqual([])
    expect(await summary()).toEqual([
      [bench.id, 80, 0],
      [bench.id, 80, 1],
      [curl.id, 12, 2],
      [squat.id, 100, 3],
    ])
  })

  it('重複のみ上書き: 重なった種目だけ元の位置で置き換え、不採用の種目は残る', async () => {
    const { bench, curl, squat, newPlan } = await setup()
    await applyPlanImport(newPlan, { mode: 'overwrite' })
    expect(await summary()).toEqual([
      [bench.id, 85, 0],
      [bench.id, 85, 1],
      [curl.id, 14, 2],
      [squat.id, 100, 3],
    ])
  })

  it('同日を全て置き換え: 一度消して新プランの順で入れ直す。不採用の種目は消える', async () => {
    const { bench, curl, squat, newPlan } = await setup()
    const preview = await previewPlanImport(newPlan, { mode: 'replaceDay' })
    expect(preview.removeBlocks).toEqual([
      {
        date: D,
        exerciseName: squat.name,
        tagName: undefined,
        round: 0,
        setCount: 1,
        performedSetCount: 0,
      },
    ])
    expect(preview.overwriteBlocks.map((b) => b.exerciseName)).toEqual([curl.name, bench.name])

    await applyPlanImport(newPlan, { mode: 'replaceDay' })
    expect(await summary()).toEqual([
      [curl.id, 14, 0],
      [bench.id, 85, 1],
      [bench.id, 85, 2],
    ])
    expect((await getBlockNote(D, B(bench.id)))?.planNote).toBe('新ベンチ指示')
    const day = await db.days.get(D)
    const location = day?.locationId ? await db.locations.get(day.locationId) : undefined
    expect(location?.name).toBe('新しいジム')
  })

  it('同日を全て置き換え: ユーザーのメモは引き継ぎ、消える種目のメモは消す。他の日・日メモは触らない', async () => {
    const { bench, squat, newPlan } = await setup()
    const benchSets = (await listSetsByDate(D)).filter((s) => s.exerciseId === bench.id)
    await updateSet(benchSets[1].id, { memo: '2セット目きつい' })
    await setBlockNote(D, B(bench.id), 'ベンチ感想')
    await setBlockNote(D, B(squat.id), 'スクワット感想')
    await db.days.update(D, { note: '日メモ' })
    await addSet({ date: '2026-10-15', exerciseId: squat.id, weight: 90, reps: 5 })

    await applyPlanImport(newPlan, { mode: 'replaceDay' })
    const newBench = (await listSetsByDate(D)).filter((s) => s.exerciseId === bench.id)
    expect(newBench.map((s) => s.memo)).toEqual([undefined, '2セット目きつい'])
    expect((await getBlockNote(D, B(bench.id)))?.note).toBe('ベンチ感想')
    expect(await getBlockNote(D, B(squat.id))).toBeUndefined()
    expect((await db.days.get(D))?.note).toBe('日メモ')
    expect(await listSetsByDate('2026-10-15')).toHaveLength(1)
  })

  it('同日を全て置き換え: 手入力の実績も消える(プランに無い種目)', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: D, exerciseId: curl.id, weight: 12, reps: 10 })
    const result = await applyPlanImport(
      planFile([{ date: D, items: [{ exercise: bench.name, sets: [{ weight: 80 }] }] }]),
      { mode: 'replaceDay' },
    )
    expect(result.removeBlocks.map((b) => b.exerciseName)).toEqual([curl.name])
    expect((await listSetsByDate(D)).map((s) => s.exerciseId)).toEqual([bench.id])
  })

  it('旧オプション overwrite: true は「重複のみ上書き」と同じ', async () => {
    const { squat, newPlan } = await setup()
    await applyPlanImport(newPlan, { overwrite: true })
    expect((await listSetsByDate(D)).some((s) => s.exerciseId === squat.id)).toBe(true)
  })

  it('実績のある種目は残す: 置き換えでも実績ブロックは消さず、プランの同じブロックも取り込まない', async () => {
    const { bench, curl, squat, newPlan } = await setup()
    // ベンチの 1 セット目に回数を記録(= 実績)。スクワット・カールは予定のまま
    const benchSets = (await listSetsByDate(D)).filter((s) => s.exerciseId === bench.id)
    await updateSet(benchSets[0].id, { reps: 5 })
    await setBlockNote(D, B(bench.id), 'ベンチ感想')

    const preview = await previewPlanImport(newPlan, { mode: 'replaceDay', keepPerformed: true })
    expect(preview.keptBlocks.map((b) => [b.exerciseName, b.performedSetCount, b.inPlan])).toEqual([
      [bench.name, 1, true],
    ])
    expect(preview.overwriteBlocks.map((b) => b.exerciseName)).toEqual([curl.name])
    expect(preview.removeBlocks.map((b) => b.exerciseName)).toEqual([squat.name])

    await applyPlanImport(newPlan, { mode: 'replaceDay', keepPerformed: true })
    expect((await listSetsByDate(D)).map((s) => [s.exerciseId, s.weight, s.reps])).toEqual([
      [bench.id, 80, 5],
      [bench.id, 80, 0],
      [curl.id, 14, 0],
    ])
    expect(await getBlockNote(D, B(bench.id))).toMatchObject({
      note: 'ベンチ感想',
      planNote: '旧ベンチ指示',
    })
  })

  it('実績のある種目は残す: プランに無い実績ブロックも残す。重複のみ上書きでも同じ', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: D, exerciseId: curl.id, weight: 12, reps: 10 })
    const plan = planFile([{ date: D, items: [{ exercise: bench.name, sets: [{ weight: 80 }] }] }])
    const result = await applyPlanImport(plan, { mode: 'replaceDay', keepPerformed: true })
    expect(result.removeBlocks).toEqual([])
    expect(result.keptBlocks.map((b) => [b.exerciseName, b.inPlan])).toEqual([[curl.name, false]])
    expect((await listSetsByDate(D)).map((s) => s.exerciseId)).toEqual([curl.id, bench.id])

    const again = planFile([{ date: D, items: [{ exercise: curl.name, sets: [{ weight: 20 }] }] }])
    const overwritten = await applyPlanImport(again, { mode: 'overwrite', keepPerformed: true })
    expect(overwritten.overwriteBlocks).toEqual([])
    expect((await listSetsByDate(D)).find((s) => s.exerciseId === curl.id)?.weight).toBe(12)
  })

  it('実績を残さない場合: 消える実績セットの数をプレビューに出す', async () => {
    const [bench, curl] = await db.exercises.toArray()
    await addSet({ date: D, exerciseId: curl.id, weight: 12, reps: 10 })
    await addSet({ date: D, exerciseId: bench.id, weight: 80, reps: 3 })
    const plan = planFile([{ date: D, items: [{ exercise: bench.name, sets: [{ weight: 85 }] }] }])
    const preview = await previewPlanImport(plan, { mode: 'replaceDay' })
    expect(preview.keptBlocks).toEqual([])
    expect(preview.removeBlocks.map((b) => b.performedSetCount)).toEqual([1])
    expect(preview.overwriteBlocks.map((b) => b.performedSetCount)).toEqual([1])
  })
})

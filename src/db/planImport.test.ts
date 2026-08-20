import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { applyPlanImport, previewPlanImport } from './planImport'
import { setBlockNote, updateSet } from './repository'
import { NO_TAG } from './types'
import type { PlanImportFile } from '../lib/planImport'

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

describe('applyPlanImport', () => {
  it('新規種目・タグ・日・セットを作成する', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        location: 'ホームジム',
        items: [
          {
            exercise: 'ケーブルクロスオーバー',
            bodyPart: '胸',
            tag: '高重量',
            sets: [{ weight: 80, memo: '目標 5reps' }, { weight: 80 }],
          },
        ],
      },
    ])

    const result = await applyPlanImport(file)
    expect(result.createExercises).toHaveLength(1)
    expect(result.createTags).toHaveLength(1)

    const exercise = await db.exercises.where('name').equals('ケーブルクロスオーバー').first()
    const tag = await db.tags.where('name').equals('高重量').first()
    expect(exercise).toBeDefined()
    expect(tag).toBeDefined()

    const day = await db.days.get('2026-07-14')
    const location = await db.locations.where('name').equals('ホームジム').first()
    expect(day?.locationId).toBe(location?.id)

    const sets = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    expect(sets).toHaveLength(2)
    expect(sets.map((s) => s.orderInDay)).toEqual([0, 1])
    expect(sets[0].reps).toBe(0) // 予定(未実施)として reps: 0
    expect(sets[0].exerciseId).toBe(exercise!.id)
    expect(sets[0].tagId).toBe(tag!.id)
    // プランの指示は planMemo(読み取り専用のプラン欄)へ。ユーザー欄 memo は空のまま(ADR-013)
    expect(sets[0].planMemo).toBe('目標 5reps')
    expect(sets[0].memo).toBeUndefined()
  })

  it('デフォルトにない部位を指定した新規種目は、部位マスタも自動作成される(未登録だと種目選択タブに出ず選べなくなるため)', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'プランク改', bodyPart: '体幹', sets: [{ weight: 0 }] }],
      },
    ])
    const result = await applyPlanImport(file)
    expect(result.createBodyParts).toEqual(['体幹'])

    const bodyPart = await db.bodyParts.where('name').equals('体幹').first()
    expect(bodyPart).toBeDefined()
    const exercise = await db.exercises.where('name').equals('プランク改').first()
    expect(exercise?.bodyPart).toBe('体幹')
  })

  it('同じファイルを2回取り込んでも重複しない(冪等)', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'スクワット', bodyPart: '脚', sets: [{ weight: 100 }] }],
      },
    ])
    await applyPlanImport(file)
    const second = await applyPlanImport(file)

    expect(second.skipBlocks).toEqual([
      { date: '2026-07-14', exerciseName: 'スクワット', tagName: undefined },
    ])
    expect(second.addBlocks).toEqual([])
    expect(await db.exercises.where('name').equals('スクワット').count()).toBe(1)
    expect(await db.sets.where('date').equals('2026-07-14').count()).toBe(1)
  })

  it('既に記録がある日でも、新しいセットは末尾に追記される(既存日を壊さない)', async () => {
    const existingExercise = (await db.exercises.toArray())[0]
    await db.sets.add({
      id: 'set-existing',
      date: '2026-07-14',
      exerciseId: existingExercise.id,
      tagId: NO_TAG,
      weight: 50,
      reps: 5,
      unit: 'kg',
      isAssisted: false,
      orderInDay: 0,
      createdAt: Date.now(),
    })
    await db.days.add({ date: '2026-07-14' })

    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'デッドリフト', bodyPart: '背中', sets: [{ weight: 120 }] }],
      },
    ])
    await applyPlanImport(file)

    const sets = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    expect(sets).toHaveLength(2)
    expect(sets[0].id).toBe('set-existing')
    expect(sets[1].orderInDay).toBe(1)
  })

  it('既存日の場所は上書きしない', async () => {
    const loc = { id: 'loc-1', name: '既存の場所', lastUsedAt: Date.now(), sortOrder: 0 }
    await db.locations.add(loc)
    await db.days.add({ date: '2026-07-14', locationId: loc.id })

    const file = planFile([
      {
        date: '2026-07-14',
        location: '別の場所',
        items: [{ exercise: 'プルアップ', bodyPart: '背中', sets: [{ weight: 0 }] }],
      },
    ])
    await applyPlanImport(file)

    const day = await db.days.get('2026-07-14')
    expect(day?.locationId).toBe('loc-1')
  })

  it('reps 未指定は 0 になる(週間集計対象外の予定として扱われる)', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: '懸垂', bodyPart: '背中', sets: [{ weight: 0 }] }],
      },
    ])
    await applyPlanImport(file)
    const sets = await db.sets.where('date').equals('2026-07-14').toArray()
    expect(sets[0].reps).toBe(0)
  })

  it('overwrite: true の場合、既存の重複ブロックを削除して新しいセットに置き換える', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'ベンチプレス', bodyPart: '胸', sets: [{ weight: 80 }] }],
      },
    ])
    await applyPlanImport(file)

    const updated = planFile([
      {
        date: '2026-07-14',
        items: [
          {
            exercise: 'ベンチプレス',
            sets: [{ weight: 85 }, { weight: 85 }],
          },
        ],
      },
    ])
    const result = await applyPlanImport(updated, { overwrite: true })

    expect(result.overwriteBlocks).toHaveLength(1)
    expect(result.addBlocks).toEqual([])
    expect(result.skipBlocks).toEqual([])

    const sets = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    expect(sets).toHaveLength(2)
    expect(sets.map((s) => s.weight)).toEqual([85, 85])
    expect(await db.exercises.where('name').equals('ベンチプレス').count()).toBe(1)
  })

  it('overwrite: true でも、他のブロックの既存セットには影響しない', async () => {
    await applyPlanImport(
      planFile([
        {
          date: '2026-07-14',
          items: [
            { exercise: 'ベンチプレス', bodyPart: '胸', sets: [{ weight: 80 }] },
            { exercise: 'スクワット', bodyPart: '脚', sets: [{ weight: 100 }] },
          ],
        },
      ]),
    )

    await applyPlanImport(
      planFile([
        { date: '2026-07-14', items: [{ exercise: 'ベンチプレス', sets: [{ weight: 90 }] }] },
      ]),
      { overwrite: true },
    )

    const squat = await db.exercises.where('name').equals('スクワット').first()
    const squatSets = await db.sets
      .where('date')
      .equals('2026-07-14')
      .filter((s) => s.exerciseId === squat!.id)
      .toArray()
    expect(squatSets).toHaveLength(1)
    expect(squatSets[0].weight).toBe(100)
  })

  it('isWarmup を指定するとウォームアップセットとして作成される', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [
          {
            exercise: 'スクワット',
            bodyPart: '脚',
            sets: [{ weight: 40, isWarmup: true }, { weight: 100 }],
          },
        ],
      },
    ])
    await applyPlanImport(file)
    const sets = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    expect(sets[0].isWarmup).toBe(true)
    expect(sets[1].isWarmup).toBeUndefined()
  })

  it('種目の note は blockNotes.planNote へ入り、ユーザーの種目メモは書き換えない', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [
          {
            exercise: 'ベンチプレス',
            bodyPart: '胸',
            note: 'フォーム: 肩甲骨を寄せる / 中止: 挙上速度が落ちたら終了',
            sets: [{ weight: 80, memo: '5回 RPE8' }],
          },
        ],
      },
    ])
    await applyPlanImport(file)
    const exercise = await db.exercises.where('name').equals('ベンチプレス').first()
    const note = await db.blockNotes.get(['2026-07-14', exercise!.id, NO_TAG])
    expect(note?.planNote).toBe('フォーム: 肩甲骨を寄せる / 中止: 挙上速度が落ちたら終了')
    expect(note?.note).toBeUndefined()
  })

  it('上書き取り込みでも、ユーザーが書いたセットメモ・種目メモは残る(ADR-013)', async () => {
    await applyPlanImport(
      planFile([
        {
          date: '2026-07-14',
          items: [
            {
              exercise: 'ベンチプレス',
              bodyPart: '胸',
              note: '旧プラン: 中止条件なし',
              sets: [
                { weight: 80, memo: '5回 RPE8' },
                { weight: 80, memo: '5回 RPE8' },
              ],
            },
          ],
        },
      ]),
    )

    // ジムでユーザーが書き込む
    const exercise = await db.exercises.where('name').equals('ベンチプレス').first()
    const before = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    await updateSet(before[0].id, { memo: '肩が痛い', reps: 5 })
    await setBlockNote('2026-07-14', exercise!.id, NO_TAG, '全体的に重かった')

    // 同じブロックのプランを上書きで取り込み直す
    await applyPlanImport(
      planFile([
        {
          date: '2026-07-14',
          items: [
            {
              exercise: 'ベンチプレス',
              note: '新プラン: 速度低下で終了',
              sets: [
                { weight: 85, memo: '3回 RPE9' },
                { weight: 85, memo: '3回 RPE9' },
              ],
            },
          ],
        },
      ]),
      { overwrite: true },
    )

    const after = await db.sets.where('date').equals('2026-07-14').sortBy('orderInDay')
    expect(after).toHaveLength(2)
    expect(after.map((s) => s.weight)).toEqual([85, 85])
    expect(after[0].planMemo).toBe('3回 RPE9')
    expect(after[0].memo).toBe('肩が痛い') // ユーザーの書き込みはセット順で引き継ぐ
    expect(after[1].memo).toBeUndefined()

    const note = await db.blockNotes.get(['2026-07-14', exercise!.id, NO_TAG])
    expect(note?.note).toBe('全体的に重かった') // ユーザー欄はそのまま
    expect(note?.planNote).toBe('新プラン: 速度低下で終了') // プラン欄だけ差し替わる
  })
})

describe('previewPlanImport', () => {
  it('db に書き込まずアクションだけ返す', async () => {
    const file = planFile([
      {
        date: '2026-07-14',
        items: [{ exercise: '新規種目X', bodyPart: '腕', sets: [{ weight: 10 }] }],
      },
    ])
    const before = await db.exercises.count()
    const preview = await previewPlanImport(file)
    expect(preview.createExercises).toEqual([{ name: '新規種目X', bodyPart: '腕' }])
    expect(await db.exercises.count()).toBe(before)
    expect(await db.sets.count()).toBe(0)
  })
})

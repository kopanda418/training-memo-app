import {
  computePlanActions,
  isPerformedSet,
  planImportModeOf,
  setKeyOf,
  type ComputePlanActionsOptions,
  type ExistingPlanData,
  type PlanActions,
  type PlanImportFile,
} from '../lib/planImport'
import { blockKeyString, groupSetsIntoBlocks, inBlock, type BlockKey } from '../lib/groupSets'
import { db } from './db'
import { getSetting } from './settings'
import { NO_TAG, type WeightUnit, type WorkoutSet } from './types'

export { validatePlanImportFile } from '../lib/planImport'
export type { PlanImportFile, PlanImportMode } from '../lib/planImport'

async function loadExistingPlanData(): Promise<ExistingPlanData> {
  const [exercises, tags, bodyParts, days, sets] = await Promise.all([
    db.exercises.toArray(),
    db.tags.toArray(),
    db.bodyParts.toArray(),
    db.days.toArray(),
    db.sets.toArray(),
  ])
  const setsByDate = new Map<string, WorkoutSet[]>()
  for (const s of [...sets].sort((a, b) => a.orderInDay - b.orderInDay)) {
    const list = setsByDate.get(s.date)
    if (list) list.push(s)
    else setsByDate.set(s.date, [s])
  }
  return {
    blocks: [...setsByDate].flatMap(([date, daySets]) =>
      groupSetsIntoBlocks(daySets).map((b) => ({
        date,
        exerciseId: b.exerciseId,
        tagId: b.tagId,
        round: b.round,
        setCount: b.sets.length,
        performedSetCount: b.sets.filter(isPerformedSet).length,
      })),
    ),
    exercises: exercises.map((e) => ({ id: e.id, name: e.name })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
    bodyPartNames: new Set(bodyParts.map((p) => p.name)),
    dayDates: new Set(days.map((d) => d.date)),
    setKeys: new Set(sets.map((s) => setKeyOf(s.date, s.exerciseId, s.tagId, s.round ?? 0))),
  }
}

/** プランファイルを検証済みの状態で受け取り、適用結果のプレビュー(書き込みなし)を返す */
export async function previewPlanImport(
  file: PlanImportFile,
  options?: ComputePlanActionsOptions,
): Promise<PlanActions> {
  return computePlanActions(file, await loadExistingPlanData(), options)
}

/** 場所を名前で解決する。同名(トリム後完全一致)があれば再利用、なければ新規作成する */
async function resolveOrCreateLocationId(name: string): Promise<string> {
  const trimmed = name.trim()
  const found = await db.locations.where('name').equals(trimmed).first()
  const now = Date.now()
  if (found) {
    await db.locations.update(found.id, { lastUsedAt: now })
    return found.id
  }
  const all = await db.locations.toArray()
  const sortOrder = all.length ? Math.max(...all.map((l) => l.sortOrder ?? 0)) + 1 : 0
  const id = crypto.randomUUID()
  await db.locations.add({ id, name: trimmed, lastUsedAt: now, sortOrder })
  return id
}

/**
 * プランを取り込む。既存記録がない date + 種目×タグ×回目 の組み合わせにはセットを追加する
 * (`docs/decisions.md` ADR-010)。`options.mode` が 'overwrite' なら、既に記録がある
 * ブロックもスキップせず、既存セットを削除してから新セットで置き換える(ADR-012)。
 * 'replaceDay' なら、ファイルに含まれる日の全セットを消してから並び順どおりに入れ直す(ADR-016)。
 * 未登録の種目・タグは name 一致で新規作成する。返り値は実行結果(プレビューと同じ形)。
 */
export async function applyPlanImport(
  file: PlanImportFile,
  options?: ComputePlanActionsOptions,
): Promise<PlanActions> {
  const unit = (await getSetting<WeightUnit>('defaultUnit')) || 'kg'
  return db.transaction(
    'rw',
    [db.exercises, db.tags, db.bodyParts, db.days, db.sets, db.locations, db.blockNotes],
    async () => {
      const [exercises, tags, bodyParts] = await Promise.all([
        db.exercises.toArray(),
        db.tags.toArray(),
        db.bodyParts.toArray(),
      ])
      const actions = computePlanActions(file, await loadExistingPlanData(), options)
      const replaceDay = planImportModeOf(options) === 'replaceDay'

      let bodyPartSortOrder = bodyParts.length
        ? Math.max(...bodyParts.map((p) => p.sortOrder)) + 1
        : 0
      for (const name of actions.createBodyParts) {
        await db.bodyParts.add({ id: crypto.randomUUID(), name, sortOrder: bodyPartSortOrder++ })
      }

      const exerciseIdByName = new Map(exercises.map((e) => [e.name, e.id]))
      let exerciseSortOrder = exercises.length
        ? Math.max(...exercises.map((e) => e.sortOrder)) + 1
        : 0
      for (const e of actions.createExercises) {
        const id = crypto.randomUUID()
        await db.exercises.add({
          id,
          name: e.name,
          bodyPart: e.bodyPart,
          sortOrder: exerciseSortOrder++,
          isArchived: false,
          createdAt: Date.now(),
        })
        exerciseIdByName.set(e.name, id)
      }

      const tagIdByName = new Map(tags.map((t) => [t.name, t.id]))
      let tagSortOrder = tags.length ? Math.max(...tags.map((t) => t.sortOrder)) + 1 : 0
      for (const t of actions.createTags) {
        const id = crypto.randomUUID()
        await db.tags.add({
          id,
          name: t.name,
          sortOrder: tagSortOrder++,
          isArchived: false,
          createdAt: Date.now(),
        })
        tagIdByName.set(t.name, id)
      }

      for (const d of actions.newDays) {
        const locationId = d.location ? await resolveOrCreateLocationId(d.location) : undefined
        await db.days.add({ date: d.date, locationId })
      }

      // replaceDay: ファイルに含まれる日の全セットを先に消す(ADR-016)。新プランにも同じブロックが
      // あれば、ユーザーのセットメモ(セット順)と種目メモを引き継ぐ。無いブロックのメモは消す
      const carriedMemos = new Map<string, (string | undefined)[]>()
      // 実績があるので残すブロック(ADR-019)。セットもメモも消さない
      const keptKeys = new Set(
        actions.keptBlocks.map(
          (b) =>
            `${b.date}|${blockKeyString({ exerciseId: b.exerciseId, tagId: b.tagId, round: b.round })}`,
        ),
      )
      if (replaceDay) {
        const newDayDates = new Set(actions.newDays.map((d) => d.date))
        const planKeys = new Set(
          actions.overwriteBlocks.map((b) => {
            const exerciseId = exerciseIdByName.get(b.exerciseName) ?? ''
            const tagId = b.tagName ? (tagIdByName.get(b.tagName) ?? '') : NO_TAG
            return `${b.date}|${blockKeyString({ exerciseId, tagId, round: b.round })}`
          }),
        )
        for (const day of file.days) {
          if (!newDayDates.has(day.date) && day.location?.trim()) {
            const locationId = await resolveOrCreateLocationId(day.location)
            await db.days.update(day.date, { locationId })
          }
          const daySets = (await db.sets.where('date').equals(day.date).toArray())
            .filter(
              (s) => !keptKeys.has(`${s.date}|${blockKeyString({ ...s, round: s.round ?? 0 })}`),
            )
            .sort((a, b) => a.orderInDay - b.orderInDay)
          for (const s of daySets) {
            const k = `${s.date}|${blockKeyString({ ...s, round: s.round ?? 0 })}`
            carriedMemos.set(k, [...(carriedMemos.get(k) ?? []), s.memo])
          }
          await db.sets.bulkDelete(daySets.map((s) => s.id))
          const notes = await db.blockNotes.where('date').equals(day.date).toArray()
          await db.blockNotes.bulkDelete(
            notes
              .filter((n) => {
                const k = `${n.date}|${blockKeyString(n)}`
                return !planKeys.has(k) && !keptKeys.has(k)
              })
              .map((n): [string, string, string, number] => [
                n.date,
                n.exerciseId,
                n.tagId,
                n.round,
              ]),
          )
        }
      }

      // ファイルの並び順(= 実施順)どおりに書き込む。追加は日の末尾へ、上書きは元のブロックの
      // 位置へ置き換える(ADR-015)。上書き時、ユーザーが書いたセットメモ(sets.memo)は
      // セット順で引き継ぐ(ADR-013)
      const orderCounters = new Map<string, number>()
      const nextOrder = async (date: string) => {
        let order = orderCounters.get(date)
        if (order === undefined) {
          const daySets = await db.sets.where('date').equals(date).toArray()
          order = daySets.length ? Math.floor(Math.max(...daySets.map((s) => s.orderInDay))) + 1 : 0
        }
        orderCounters.set(date, order + 1)
        return order
      }
      const touchedDates = new Set<string>()

      const now = Date.now()
      const blocks = [
        ...actions.addBlocks.map((b) => ({ b, overwrite: false })),
        ...actions.overwriteBlocks.map((b) => ({ b, overwrite: true })),
      ].sort((x, y) => x.b.seq - y.b.seq)
      for (const { b: block, overwrite } of blocks) {
        const exerciseId = exerciseIdByName.get(block.exerciseName)
        const tagId = block.tagName ? tagIdByName.get(block.tagName) : NO_TAG
        if (!exerciseId || tagId === undefined) continue
        const key: BlockKey = { exerciseId, tagId, round: block.round }
        touchedDates.add(block.date)

        let carried: (string | undefined)[] | undefined
        let basePosition: number | undefined
        if (overwrite && replaceDay) {
          // 既に消してあるので、メモだけ受け取って新プランの並び順の位置に入れる
          carried = carriedMemos.get(`${block.date}|${blockKeyString(key)}`)
        } else if (overwrite) {
          const oldSets = (await db.sets.where('date').equals(block.date).toArray())
            .filter((s) => inBlock(s, key))
            .sort((a, b) => a.orderInDay - b.orderInDay)
          carried = oldSets.map((s) => s.memo)
          if (oldSets.length) basePosition = oldSets[0].orderInDay
          await db.sets.bulkDelete(oldSets.map((s) => s.id))
        }

        const newSets: WorkoutSet[] = []
        for (const [i, s] of block.sets.entries()) {
          newSets.push({
            id: crypto.randomUUID(),
            date: block.date,
            exerciseId,
            tagId,
            weight: s.weight,
            isBodyweight: s.isBodyweight,
            isWarmup: s.isWarmup,
            attributes: s.attributes,
            reps: s.reps ?? 0,
            unit: s.unit ?? unit,
            // memo はユーザー欄。プランの指示は planMemo に入れる(ADR-013)
            memo: carried?.[i],
            planMemo: s.memo,
            isAssisted: false,
            // 上書きは元の位置に小数で差し込み、最後に日全体を整数へ振り直す
            orderInDay:
              basePosition !== undefined
                ? basePosition + (i + 1) / (block.sets.length + 1)
                : await nextOrder(block.date),
            round: block.round || undefined,
            createdAt: now,
          })
        }
        await db.sets.bulkAdd(newSets)

        // 種目単位の指示は blockNotes.planNote へ。ユーザーが書いた note には触れない
        const noteKey: [string, string, string, number] = [
          block.date,
          exerciseId,
          tagId,
          block.round,
        ]
        const existingNote = await db.blockNotes.get(noteKey)
        if (block.note) {
          await db.blockNotes.put({
            ...existingNote,
            date: block.date,
            exerciseId,
            tagId,
            round: block.round,
            planNote: block.note,
          })
        } else if (existingNote?.planNote) {
          // このブロックのプランを取り込み直したので、古い指示は残さない
          if (existingNote.note) {
            await db.blockNotes.put({ ...existingNote, planNote: undefined })
          } else {
            await db.blockNotes.delete(noteKey)
          }
        }
      }

      for (const date of touchedDates) {
        const daySets = (await db.sets.where('date').equals(date).toArray()).sort(
          (a, b) => a.orderInDay - b.orderInDay,
        )
        await db.sets.bulkPut(daySets.map((s, i) => ({ ...s, orderInDay: i })))
      }

      return actions
    },
  )
}

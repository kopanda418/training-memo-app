import {
  computePlanActions,
  setKeyOf,
  type ComputePlanActionsOptions,
  type ExistingPlanData,
  type PlanActions,
  type PlanImportFile,
} from '../lib/planImport'
import { db } from './db'
import { getSetting } from './settings'
import { NO_TAG, type WeightUnit, type WorkoutSet } from './types'

export { validatePlanImportFile } from '../lib/planImport'
export type { PlanImportFile } from '../lib/planImport'

async function loadExistingPlanData(): Promise<ExistingPlanData> {
  const [exercises, tags, bodyParts, days, sets] = await Promise.all([
    db.exercises.toArray(),
    db.tags.toArray(),
    db.bodyParts.toArray(),
    db.days.toArray(),
    db.sets.toArray(),
  ])
  return {
    exercises: exercises.map((e) => ({ id: e.id, name: e.name })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
    bodyPartNames: new Set(bodyParts.map((p) => p.name)),
    dayDates: new Set(days.map((d) => d.date)),
    setKeys: new Set(sets.map((s) => setKeyOf(s.date, s.exerciseId, s.tagId))),
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
 * プランを取り込む。既存記録がない date + 種目×タグ の組み合わせにはセットを追加する
 * (`docs/decisions.md` ADR-010)。`options.overwrite` を true にすると、既に記録がある
 * ブロックもスキップせず、既存セットを削除してから新セットで置き換える(ADR-012)。
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

      // 上書き対象ブロックは、新セットを追加する前に既存セットを削除しておく。
      // このときユーザーが書いたセットメモ(sets.memo)はセット順で引き継ぐ(ADR-013)
      const carriedMemos = new Map<string, (string | undefined)[]>()
      for (const block of actions.overwriteBlocks) {
        const exerciseId = exerciseIdByName.get(block.exerciseName)
        const tagId = block.tagName ? tagIdByName.get(block.tagName) : NO_TAG
        if (!exerciseId || tagId === undefined) continue
        const oldSets = await db.sets
          .where('date')
          .equals(block.date)
          .filter((s) => s.exerciseId === exerciseId && s.tagId === tagId)
          .toArray()
        oldSets.sort((a, b) => a.orderInDay - b.orderInDay)
        carriedMemos.set(
          setKeyOf(block.date, exerciseId, tagId),
          oldSets.map((s) => s.memo),
        )
        await db.sets.bulkDelete(oldSets.map((s) => s.id))
      }

      const orderCounters = new Map<string, number>()
      const nextOrder = async (date: string) => {
        let order = orderCounters.get(date)
        if (order === undefined) {
          const daySets = await db.sets.where('date').equals(date).toArray()
          order = daySets.length ? Math.max(...daySets.map((s) => s.orderInDay)) + 1 : 0
        }
        orderCounters.set(date, order + 1)
        return order
      }

      const now = Date.now()
      for (const block of [...actions.addBlocks, ...actions.overwriteBlocks]) {
        const exerciseId = exerciseIdByName.get(block.exerciseName)
        const tagId = block.tagName ? tagIdByName.get(block.tagName) : NO_TAG
        if (!exerciseId || tagId === undefined) continue
        const carried = carriedMemos.get(setKeyOf(block.date, exerciseId, tagId))
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
            orderInDay: await nextOrder(block.date),
            createdAt: now,
          })
        }
        await db.sets.bulkAdd(newSets)

        // 種目単位の指示は blockNotes.planNote へ。ユーザーが書いた note には触れない
        const noteKey: [string, string, string] = [block.date, exerciseId, tagId]
        const existingNote = await db.blockNotes.get(noteKey)
        if (block.note) {
          await db.blockNotes.put({
            ...existingNote,
            date: block.date,
            exerciseId,
            tagId,
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

      return actions
    },
  )
}

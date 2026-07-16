import {
  computePlanActions,
  setKeyOf,
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
export async function previewPlanImport(file: PlanImportFile): Promise<PlanActions> {
  return computePlanActions(file, await loadExistingPlanData())
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
 * プランを取り込む(追加専用)。既存データは書き換えず、まだ記録がない
 * date + 種目×タグ の組み合わせにだけセットを追加する(`docs/decisions.md` ADR-010)。
 * 未登録の種目・タグは name 一致で新規作成する。返り値は実行結果(プレビューと同じ形)。
 */
export async function applyPlanImport(file: PlanImportFile): Promise<PlanActions> {
  const unit = (await getSetting<WeightUnit>('defaultUnit')) || 'kg'
  return db.transaction(
    'rw',
    [db.exercises, db.tags, db.bodyParts, db.days, db.sets, db.locations],
    async () => {
      const [exercises, tags, bodyParts] = await Promise.all([
        db.exercises.toArray(),
        db.tags.toArray(),
        db.bodyParts.toArray(),
      ])
      const actions = computePlanActions(file, await loadExistingPlanData())

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
      for (const block of actions.addBlocks) {
        const exerciseId = exerciseIdByName.get(block.exerciseName)
        const tagId = block.tagName ? tagIdByName.get(block.tagName) : NO_TAG
        if (!exerciseId || tagId === undefined) continue
        const newSets: WorkoutSet[] = []
        for (const s of block.sets) {
          newSets.push({
            id: crypto.randomUUID(),
            date: block.date,
            exerciseId,
            tagId,
            weight: s.weight,
            isBodyweight: s.isBodyweight,
            isWarmup: s.isWarmup,
            reps: s.reps ?? 0,
            unit: s.unit ?? unit,
            memo: s.memo,
            isAssisted: false,
            orderInDay: await nextOrder(block.date),
            createdAt: now,
          })
        }
        await db.sets.bulkAdd(newSets)
      }

      return actions
    },
  )
}

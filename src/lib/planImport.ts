import { NO_TAG, type WeightUnit } from '../db/types'

export const PLAN_IMPORT_KIND = 'plan-import'
export const PLAN_IMPORT_FORMAT_VERSION = 1

export interface PlanSetInput {
  weight: number
  unit?: WeightUnit
  /** 省略時は 0(未実施の予定として扱われ、週間集計・MAX判定から除外される) */
  reps?: number
  isBodyweight?: boolean
  memo?: string
}

export interface PlanItemInput {
  /** 種目名。既存の種目マスタと name 完全一致で照合する */
  exercise: string
  /** 新規種目を作る場合のみ必須 */
  bodyPart?: string
  /** タグ名。省略でタグなし */
  tag?: string
  sets: PlanSetInput[]
}

export interface PlanDayInput {
  /** "YYYY-MM-DD" */
  date: string
  /** 新規に日を作る場合のみ適用(既存日の場所は上書きしない) */
  location?: string
  items: PlanItemInput[]
}

export interface PlanImportFile {
  app: 'training-memo-app'
  kind: 'plan-import'
  formatVersion: number
  days: PlanDayInput[]
}

export function validatePlanImportFile(value: unknown): PlanImportFile {
  if (typeof value !== 'object' || value === null) {
    throw new Error('プランファイルの形式が不正です')
  }
  const v = value as Partial<PlanImportFile>
  if (v.app !== 'training-memo-app') {
    throw new Error('このアプリのファイルではありません')
  }
  if (v.kind !== PLAN_IMPORT_KIND) {
    throw new Error(
      'プラン取り込み用のファイルではありません(バックアップファイルは「復元する」から取り込んでください)',
    )
  }
  if (typeof v.formatVersion !== 'number' || v.formatVersion > PLAN_IMPORT_FORMAT_VERSION) {
    throw new Error(
      `プランファイルの形式バージョン (${String(v.formatVersion)}) に対応していません`,
    )
  }
  if (!Array.isArray(v.days)) {
    throw new Error('プランファイルに days がありません')
  }
  for (const day of v.days) {
    if (typeof day.date !== 'string' || !Array.isArray(day.items)) {
      throw new Error('プランファイルの日データが不正です')
    }
    for (const item of day.items) {
      if (typeof item.exercise !== 'string' || !item.exercise.trim() || !Array.isArray(item.sets)) {
        throw new Error('プランファイルの種目データが不正です')
      }
      for (const s of item.sets) {
        if (typeof s.weight !== 'number') {
          throw new Error('プランファイルのセットデータが不正です(weight は必須)')
        }
      }
    }
  }
  return value as PlanImportFile
}

/** computePlanActions が参照する現在の db 状態(最小限のフィールドのみ) */
export interface ExistingPlanData {
  exercises: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  /** 既に days レコードがある日付 */
  dayDates: ReadonlySet<string>
  /** 既存セットの `date|exerciseId|tagId` キー集合(スキップ判定用) */
  setKeys: ReadonlySet<string>
}

export function setKeyOf(date: string, exerciseId: string, tagId: string): string {
  return `${date}|${exerciseId}|${tagId}`
}

export interface PlanBlock {
  date: string
  exerciseName: string
  tagName?: string
  sets: PlanSetInput[]
}

export interface PlanActions {
  createExercises: { name: string; bodyPart: string }[]
  createTags: { name: string }[]
  /** 新規に作成する日(location はその日のみ適用) */
  newDays: { date: string; location?: string }[]
  /** 追加するブロック(種目×タグ単位) */
  addBlocks: PlanBlock[]
  /** 既に記録があるためスキップするブロック */
  skipBlocks: { date: string; exerciseName: string; tagName?: string }[]
  /** 取り込み不可のエラー(該当項目は addBlocks に含まれない) */
  errors: string[]
}

/**
 * プランファイルと現在の db 状態から、実行すべきアクションを計算する純粋関数。
 * db には触れない(プレビュー表示と実書き込みの両方がこれを使う)。
 */
export function computePlanActions(file: PlanImportFile, existing: ExistingPlanData): PlanActions {
  const actions: PlanActions = {
    createExercises: [],
    createTags: [],
    newDays: [],
    addBlocks: [],
    skipBlocks: [],
    errors: [],
  }

  const exerciseByName = new Map(existing.exercises.map((e) => [e.name, e]))
  const tagByName = new Map(existing.tags.map((t) => [t.name, t]))
  const pendingExerciseNames = new Set<string>()
  const pendingTagNames = new Set<string>()
  const newDayDates = new Set<string>()

  for (const day of file.days) {
    const date = day.date
    if (!existing.dayDates.has(date) && !newDayDates.has(date)) {
      newDayDates.add(date)
      actions.newDays.push({ date, location: day.location?.trim() || undefined })
    }

    for (const item of day.items) {
      const exerciseName = item.exercise.trim()
      const existingExercise = exerciseByName.get(exerciseName)
      if (!existingExercise && !pendingExerciseNames.has(exerciseName)) {
        const bodyPart = item.bodyPart?.trim()
        if (!bodyPart) {
          actions.errors.push(
            `種目「${exerciseName}」が未登録で、bodyPart(部位)が指定されていません`,
          )
          continue
        }
        actions.createExercises.push({ name: exerciseName, bodyPart })
        pendingExerciseNames.add(exerciseName)
      }
      // 既に新規作成予定(pending)の種目名はそのまま続行(2件目以降は bodyPart 未指定でもエラーにしない)

      const tagName = item.tag?.trim()
      let existingTagId: string | undefined
      if (!tagName) {
        existingTagId = NO_TAG
      } else {
        const existingTag = tagByName.get(tagName)
        if (existingTag) {
          existingTagId = existingTag.id
        } else {
          if (!pendingTagNames.has(tagName)) {
            actions.createTags.push({ name: tagName })
            pendingTagNames.add(tagName)
          }
          existingTagId = undefined // 新規タグ = 既存セットは存在し得ない
        }
      }

      const canCheckSkip = !!existingExercise && existingTagId !== undefined
      const skip =
        canCheckSkip && existing.setKeys.has(setKeyOf(date, existingExercise!.id, existingTagId!))

      if (skip) {
        actions.skipBlocks.push({ date, exerciseName, tagName })
      } else {
        actions.addBlocks.push({ date, exerciseName, tagName, sets: item.sets })
      }
    }
  }

  return actions
}

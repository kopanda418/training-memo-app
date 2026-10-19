import { NO_TAG, type WeightUnit } from '../db/types'

export const PLAN_IMPORT_KIND = 'plan-import'
export const PLAN_IMPORT_FORMAT_VERSION = 1

export interface PlanSetInput {
  weight: number
  unit?: WeightUnit
  /** 省略時は 0(未実施の予定として扱われ、週間集計・MAX判定から除外される) */
  reps?: number
  isBodyweight?: boolean
  /** ウォームアップセットか(週間集計・MAX判定から除外される) */
  isWarmup?: boolean
  /** セット属性(任意テキスト、複数可。例: 「左」「フル」「DS」。既存の属性バンクと name 一致で照合されない単純な文字列としてそのまま保存される) */
  attributes?: string[]
  /**
   * このセットの指示(短い1行。例: 「5回 RPE8」)。
   * db では `sets.planMemo`(読み取り専用のプラン欄)に入る。ユーザーが書く `sets.memo` とは別枠で、
   * 取り込み側がユーザーの書き込みを消すことはない(ADR-013)
   */
  memo?: string
}

export interface PlanItemInput {
  /** 種目名。既存の種目マスタと name 完全一致で照合する */
  exercise: string
  /** 新規種目を作る場合のみ必須 */
  bodyPart?: string
  /** タグ名。省略でタグなし */
  tag?: string
  /**
   * この種目の指示(フォーム注意点・中止条件など、全セット共通の内容)。
   * db では `blockNotes.planNote`(読み取り専用のプラン欄)に入る。ユーザーが書く
   * 種目メモ(`blockNotes.note`)は取り込みで書き換えない(ADR-013)
   */
  note?: string
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
  /** 生成側が勧める上書き方法(任意)。取り込み画面の初期値になる(ADR-019) */
  recommendedMode?: PlanImportMode
  days: PlanDayInput[]
}

const PLAN_IMPORT_MODES: readonly string[] = ['skip', 'overwrite', 'replaceDay']

/** ファイルの recommendedMode を読む。無い・不明な値なら undefined */
export const recommendedModeOf = (file: PlanImportFile): PlanImportMode | undefined =>
  typeof file.recommendedMode === 'string' && PLAN_IMPORT_MODES.includes(file.recommendedMode)
    ? file.recommendedMode
    : undefined

/** 実績が入っているセットか(reps 0 = 未実施の予定。ADR-019) */
export const isPerformedSet = (s: { reps: number }): boolean => s.reps > 0

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
  /** 既存の部位マスタの name 集合(新規種目の bodyPart 自動作成判定用) */
  bodyPartNames: ReadonlySet<string>
  /** 既に days レコードがある日付 */
  dayDates: ReadonlySet<string>
  /** 既存セットの `date|exerciseId|tagId|round` キー集合(スキップ判定用) */
  setKeys: ReadonlySet<string>
  /** 既存のブロック一覧(replaceDay で削除される種目のプレビュー用。ADR-016) */
  blocks?: {
    date: string
    exerciseId: string
    tagId: string
    round: number
    setCount: number
    /** 実績が入っているセット数(ADR-019) */
    performedSetCount?: number
  }[]
}

export function setKeyOf(date: string, exerciseId: string, tagId: string, round = 0): string {
  return `${date}|${exerciseId}|${tagId}|${round}`
}

export interface PlanBlock {
  date: string
  exerciseName: string
  tagName?: string
  /**
   * 回目(ADR-015)。同じ日の items に同じ種目×タグが複数あれば、出現順に 0, 1, 2…
   * items の並び順 = 実施順
   */
  round: number
  /** ファイル内の出現順(追加と上書きを並び順どおりに書き込むため) */
  seq: number
  /** 種目単位のプラン指示(blockNotes.planNote へ書く) */
  note?: string
  sets: PlanSetInput[]
  /** 上書きで消える既存ブロックの、実績が入ったセット数(overwriteBlocks のみ。ADR-019) */
  performedSetCount?: number
}

export interface PlanActions {
  createBodyParts: string[]
  createExercises: { name: string; bodyPart: string }[]
  createTags: { name: string }[]
  /** 新規に作成する日(location はその日のみ適用) */
  newDays: { date: string; location?: string }[]
  /** 追加するブロック(種目×タグ単位、既存記録なし) */
  addBlocks: PlanBlock[]
  /** 既存セットを削除して置き換えるブロック(overwrite 指定時のみ発生) */
  overwriteBlocks: PlanBlock[]
  /** 既に記録があるためスキップするブロック(mode: skip のとき) */
  skipBlocks: { date: string; exerciseName: string; tagName?: string; round: number }[]
  /** 新プランに無いため削除されるブロック(mode: replaceDay のときのみ。ADR-016) */
  removeBlocks: {
    date: string
    exerciseName: string
    tagName?: string
    round: number
    setCount: number
    /** 実績が入ったセット数(ADR-019) */
    performedSetCount: number
  }[]
  /** 実績があるため消さずに残すブロック(keepPerformed のとき。ADR-019) */
  keptBlocks: {
    date: string
    exerciseId: string
    tagId: string
    exerciseName: string
    tagName?: string
    round: number
    setCount: number
    performedSetCount: number
    /** 新プランにも同じブロックがあった(= プラン側を取り込まない) */
    inPlan: boolean
  }[]
  /** 取り込み不可のエラー(該当項目は addBlocks に含まれない) */
  errors: string[]
}

/**
 * 既存記録との重複の扱い(ADR-016)
 * - skip: 重複ブロックはスキップ(既定)
 * - overwrite: 重複ブロックだけ置き換え、他の既存ブロックは残す
 * - replaceDay: ファイルに含まれる日の全セットを消してから入れ直す
 */
export type PlanImportMode = 'skip' | 'overwrite' | 'replaceDay'

export interface ComputePlanActionsOptions {
  mode?: PlanImportMode
  /** @deprecated mode: 'overwrite' と同じ(互換用) */
  overwrite?: boolean
  /** 実績のあるブロックは上書き・削除せず残す(ADR-019。取り込み画面の既定はオン) */
  keepPerformed?: boolean
}

export const planImportModeOf = (options?: ComputePlanActionsOptions): PlanImportMode =>
  options?.mode ?? (options?.overwrite ? 'overwrite' : 'skip')

/**
 * プランファイルと現在の db 状態から、実行すべきアクションを計算する純粋関数。
 * db には触れない(プレビュー表示と実書き込みの両方がこれを使う)。
 */
export function computePlanActions(
  file: PlanImportFile,
  existing: ExistingPlanData,
  options?: ComputePlanActionsOptions,
): PlanActions {
  const mode = planImportModeOf(options)
  const overwrite = mode !== 'skip'
  const actions: PlanActions = {
    createBodyParts: [],
    createExercises: [],
    createTags: [],
    newDays: [],
    addBlocks: [],
    overwriteBlocks: [],
    skipBlocks: [],
    removeBlocks: [],
    keptBlocks: [],
    errors: [],
  }
  const keepPerformed = overwrite && !!options?.keepPerformed
  const existingBlockByKey = new Map(
    (existing.blocks ?? []).map((b) => [setKeyOf(b.date, b.exerciseId, b.tagId, b.round), b]),
  )
  const exerciseNameById = new Map(existing.exercises.map((e) => [e.id, e.name]))
  const tagNameById = new Map(existing.tags.map((t) => [t.id, t.name]))
  const keptKeys = new Set<string>()
  const keep = (b: NonNullable<ExistingPlanData['blocks']>[number], inPlan: boolean) => {
    keptKeys.add(setKeyOf(b.date, b.exerciseId, b.tagId, b.round))
    actions.keptBlocks.push({
      date: b.date,
      exerciseId: b.exerciseId,
      tagId: b.tagId,
      exerciseName: exerciseNameById.get(b.exerciseId) ?? '(不明な種目)',
      tagName: b.tagId === NO_TAG ? undefined : (tagNameById.get(b.tagId) ?? '(不明なタグ)'),
      round: b.round,
      setCount: b.setCount,
      performedSetCount: b.performedSetCount ?? 0,
      inPlan,
    })
  }

  const exerciseByName = new Map(existing.exercises.map((e) => [e.name, e]))
  const tagByName = new Map(existing.tags.map((t) => [t.name, t]))
  const pendingExerciseNames = new Set<string>()
  const pendingTagNames = new Set<string>()
  const pendingBodyPartNames = new Set<string>()
  const newDayDates = new Set<string>()
  let seq = 0

  for (const day of file.days) {
    const date = day.date
    // 同じ日に同じ種目×タグが何回目か(名前で数える。ADR-015)
    const occurrences = new Map<string, number>()
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
        if (!existing.bodyPartNames.has(bodyPart) && !pendingBodyPartNames.has(bodyPart)) {
          actions.createBodyParts.push(bodyPart)
          pendingBodyPartNames.add(bodyPart)
        }
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

      const occurrenceKey = `${exerciseName}|${tagName ?? ''}`
      const round = occurrences.get(occurrenceKey) ?? 0
      occurrences.set(occurrenceKey, round + 1)

      const canCheckSkip = !!existingExercise && existingTagId !== undefined
      const hasConflict =
        canCheckSkip &&
        existing.setKeys.has(setKeyOf(date, existingExercise!.id, existingTagId!, round))

      const note = item.note?.trim() || undefined
      const block: PlanBlock = {
        date,
        exerciseName,
        tagName,
        round,
        seq: seq++,
        note,
        sets: item.sets,
      }
      const existingBlock = hasConflict
        ? existingBlockByKey.get(setKeyOf(date, existingExercise!.id, existingTagId!, round))
        : undefined
      const performedSetCount = existingBlock?.performedSetCount ?? 0
      if (hasConflict && !overwrite) {
        actions.skipBlocks.push({ date, exerciseName, tagName, round })
      } else if (hasConflict && keepPerformed && performedSetCount > 0 && existingBlock) {
        keep(existingBlock, true)
      } else if (hasConflict && overwrite) {
        actions.overwriteBlocks.push(
          performedSetCount > 0 ? { ...block, performedSetCount } : block,
        )
      } else {
        actions.addBlocks.push(block)
      }
    }
  }

  if (mode === 'replaceDay') {
    // 新プランで同じ 日付×種目×タグ×回目 に当たらない既存ブロックは削除される
    const planKeys = new Set<string>()
    for (const b of [...actions.addBlocks, ...actions.overwriteBlocks]) {
      const ex = exerciseByName.get(b.exerciseName)
      const tagId = b.tagName ? tagByName.get(b.tagName)?.id : NO_TAG
      if (ex && tagId !== undefined) planKeys.add(setKeyOf(b.date, ex.id, tagId, b.round))
    }
    const planDates = new Set(file.days.map((d) => d.date))
    for (const b of existing.blocks ?? []) {
      if (!planDates.has(b.date)) continue
      const key = setKeyOf(b.date, b.exerciseId, b.tagId, b.round)
      if (planKeys.has(key) || keptKeys.has(key)) continue
      if (keepPerformed && (b.performedSetCount ?? 0) > 0) {
        keep(b, false)
        continue
      }
      actions.removeBlocks.push({
        date: b.date,
        exerciseName: exerciseNameById.get(b.exerciseId) ?? '(不明な種目)',
        tagName: b.tagId === NO_TAG ? undefined : (tagNameById.get(b.tagId) ?? '(不明なタグ)'),
        round: b.round,
        setCount: b.setCount,
        performedSetCount: b.performedSetCount ?? 0,
      })
    }
  }

  return actions
}

import { groupSetsIntoBlocks } from '../lib/groupSets'
import { estimateOneRepMax } from '../lib/oneRepMax'
import { effectiveLoad } from '../lib/setFormat'
import { db } from './db'
import { getSetting } from './settings'
import { NO_TAG, type Day, type Tag, type WeightUnit, type WorkoutSet } from './types'

export interface NewSetInput {
  date: string
  exerciseId: string
  /** 省略時はタグなし */
  tagId?: string
  weight: number
  isBodyweight?: boolean
  isWarmup?: boolean
  reps: number
  targetReps?: number
  attribute?: string
  isAssisted?: boolean
  unit?: WeightUnit
  memo?: string
}

/** セットを追加する。日レコードがなければ作り、orderInDay は日内の末尾になる */
export async function addSet(input: NewSetInput): Promise<WorkoutSet> {
  // settings はトランザクション対象外のテーブルなので、開始前に読む
  const unit = input.unit ?? ((await getSetting<WeightUnit>('defaultUnit')) || 'kg')
  return db.transaction('rw', [db.sets, db.days], async () => {
    const existing = await db.sets.where('date').equals(input.date).toArray()
    const orderInDay = existing.length ? Math.max(...existing.map((s) => s.orderInDay)) + 1 : 0
    const set: WorkoutSet = {
      id: crypto.randomUUID(),
      date: input.date,
      exerciseId: input.exerciseId,
      tagId: input.tagId ?? NO_TAG,
      weight: input.weight,
      isBodyweight: input.isBodyweight,
      isWarmup: input.isWarmup,
      reps: input.reps,
      targetReps: input.targetReps,
      attribute: input.attribute,
      isAssisted: input.isAssisted ?? false,
      // 単位の優先順: 明示指定(前セット引き継ぎ) > 設定のデフォルト > kg
      unit,
      memo: input.memo,
      orderInDay,
      createdAt: Date.now(),
    }
    await db.sets.add(set)
    await ensureDay(input.date)
    return set
  })
}

export async function updateSet(
  id: string,
  changes: Partial<
    Pick<
      WorkoutSet,
      | 'weight'
      | 'isBodyweight'
      | 'isWarmup'
      | 'reps'
      | 'targetReps'
      | 'attribute'
      | 'isAssisted'
      | 'unit'
      | 'memo'
      | 'tagId'
    >
  >,
): Promise<void> {
  await db.sets.update(id, changes)
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id)
}

/** 指定日のセット一覧(表示順) */
export async function listSetsByDate(date: string): Promise<WorkoutSet[]> {
  const sets = await db.sets.where('date').equals(date).toArray()
  return sets.sort((a, b) => a.orderInDay - b.orderInDay)
}

/** 種目×タグの全履歴(日付降順、日内は表示順) */
export async function listHistory(
  exerciseId: string,
  tagId: string = NO_TAG,
): Promise<WorkoutSet[]> {
  const sets = await db.sets.where('[exerciseId+tagId]').equals([exerciseId, tagId]).toArray()
  return sets.sort((a, b) =>
    a.date === b.date ? a.orderInDay - b.orderInDay : b.date.localeCompare(a.date),
  )
}

export async function getDay(date: string): Promise<Day | undefined> {
  return db.days.get(date)
}

async function ensureDay(date: string): Promise<Day> {
  const existing = await db.days.get(date)
  if (existing) return existing
  const day: Day = { date }
  await db.days.add(day)
  return day
}

/**
 * 日のトレーニング場所を設定する。
 * 同名の場所(トリム後の完全一致)があれば再利用し、なければ新規作成する。
 * name が空なら場所設定を解除する。
 */
export async function setDayLocation(date: string, name: string): Promise<void> {
  const trimmed = name.trim()
  await db.transaction('rw', [db.days, db.locations], async () => {
    await ensureDay(date)
    if (!trimmed) {
      await db.days.update(date, { locationId: undefined })
      return
    }
    const found = await db.locations.where('name').equals(trimmed).first()
    const now = Date.now()
    let locationId: string
    if (found) {
      locationId = found.id
      await db.locations.update(found.id, { lastUsedAt: now })
    } else {
      locationId = crypto.randomUUID()
      await db.locations.add({ id: locationId, name: trimmed, lastUsedAt: now })
    }
    await db.days.update(date, { locationId })
  })
}

/** 場所の入力候補(最近使った順) */
export async function listLocations() {
  const locations = await db.locations.toArray()
  return locations.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** 種目×タグの直近セット(新規セットのプリフィル用)。beforeOrOn を渡すとその日以前に限定 */
export async function getLastSet(
  exerciseId: string,
  tagId: string = NO_TAG,
  beforeOrOn?: string,
): Promise<WorkoutSet | undefined> {
  const history = await db.sets.where('[exerciseId+tagId]').equals([exerciseId, tagId]).toArray()
  const candidates = beforeOrOn ? history.filter((s) => s.date <= beforeOrOn) : history
  if (!candidates.length) return undefined
  return candidates.sort((a, b) =>
    a.date === b.date ? a.orderInDay - b.orderInDay : a.date.localeCompare(b.date),
  )[candidates.length - 1]
}

/**
 * 種目×タグの「前回(targetDate より前の直近の日)」の全セットを targetDate 末尾にコピーする。
 * コピーしたセット数を返す(前回記録がなければ 0)
 */
export async function copyPreviousSession(
  targetDate: string,
  exerciseId: string,
  tagId: string = NO_TAG,
  options?: { clearReps?: boolean },
): Promise<number> {
  return db.transaction('rw', [db.sets, db.days], async () => {
    const history = await db.sets.where('[exerciseId+tagId]').equals([exerciseId, tagId]).toArray()
    const prevDates = history.filter((s) => s.date < targetDate).map((s) => s.date)
    if (!prevDates.length) return 0
    const sourceDate = prevDates.sort()[prevDates.length - 1]
    const sourceSets = history
      .filter((s) => s.date === sourceDate)
      .sort((a, b) => a.orderInDay - b.orderInDay)

    const existing = await db.sets.where('date').equals(targetDate).toArray()
    let order = existing.length ? Math.max(...existing.map((s) => s.orderInDay)) + 1 : 0
    const now = Date.now()
    await db.sets.bulkAdd(
      sourceSets.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        date: targetDate,
        // clearReps: 実績はこれから積むので空欄にする(テンプレート展開用)
        reps: options?.clearReps ? 0 : s.reps,
        orderInDay: order++,
        createdAt: now,
      })),
    )
    await ensureDay(targetDate)
    return sourceSets.length
  })
}

/** 期間内の全セット(週間集計用) */
export async function listSetsInRange(fromDate: string, toDate: string): Promise<WorkoutSet[]> {
  return db.sets.where('date').between(fromDate, toDate, true, true).toArray()
}

/** 期間内で記録(セット)がある日付の一覧(カレンダーのマーク用) */
export async function listRecordedDates(fromDate: string, toDate: string): Promise<string[]> {
  const sets = await db.sets.where('date').between(fromDate, toDate, true, true).toArray()
  return [...new Set(sets.map((s) => s.date))]
}

export interface TransferOptions {
  fromDate: string
  toDate: string
  mode: 'copy' | 'move'
  /** 指定すると、その種目×タグのブロックだけを対象にする(未指定なら日全体) */
  exerciseId?: string
  tagId?: string
}

/**
 * 記録を別の日へコピー/移動する(日全体または種目×タグ単位)。
 * 移動元/先は 1 トランザクション。移動でセットが空になった日は days レコードも削除する。
 * 対象セット数を返す。
 */
export async function transferSets(options: TransferOptions): Promise<number> {
  const { fromDate, toDate, mode, exerciseId } = options
  const tagId = options.tagId ?? NO_TAG
  if (fromDate === toDate) return 0
  return db.transaction('rw', [db.sets, db.days], async () => {
    let source = await db.sets.where('date').equals(fromDate).toArray()
    if (exerciseId !== undefined) {
      source = source.filter((s) => s.exerciseId === exerciseId && s.tagId === tagId)
    }
    if (!source.length) return 0
    source.sort((a, b) => a.orderInDay - b.orderInDay)

    const existing = await db.sets.where('date').equals(toDate).toArray()
    let order = existing.length ? Math.max(...existing.map((s) => s.orderInDay)) + 1 : 0

    if (mode === 'copy') {
      const now = Date.now()
      await db.sets.bulkAdd(
        source.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          date: toDate,
          orderInDay: order++,
          createdAt: now,
        })),
      )
    } else {
      await db.sets.bulkPut(source.map((s) => ({ ...s, date: toDate, orderInDay: order++ })))
      const remaining = await db.sets.where('date').equals(fromDate).count()
      if (remaining === 0) await db.days.delete(fromDate)
    }
    await ensureDay(toDate)
    return source.length
  })
}

/** 日の中で種目×タグブロックの表示順を 1 つ上/下へ移動する(orderInDay を振り直す) */
export async function moveBlockInDay(
  date: string,
  exerciseId: string,
  tagId: string,
  direction: 'up' | 'down',
): Promise<void> {
  await db.transaction('rw', [db.sets], async () => {
    const sets = (await db.sets.where('date').equals(date).toArray()).sort(
      (a, b) => a.orderInDay - b.orderInDay,
    )
    const blocks = groupSetsIntoBlocks(sets)
    const index = blocks.findIndex((b) => b.exerciseId === exerciseId && b.tagId === tagId)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= blocks.length) return
    ;[blocks[index], blocks[swapWith]] = [blocks[swapWith], blocks[index]]
    let order = 0
    await db.sets.bulkPut(blocks.flatMap((b) => b.sets.map((s) => ({ ...s, orderInDay: order++ }))))
  })
}

/** ブロック内のセットを指定順に並べ替える(orderInDay を日全体で振り直す) */
export async function reorderSetsInBlock(
  date: string,
  exerciseId: string,
  tagId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', [db.sets], async () => {
    const sets = (await db.sets.where('date').equals(date).toArray()).sort(
      (a, b) => a.orderInDay - b.orderInDay,
    )
    const blocks = groupSetsIntoBlocks(sets)
    const block = blocks.find((b) => b.exerciseId === exerciseId && b.tagId === tagId)
    if (!block) return
    const byId = new Map(block.sets.map((s) => [s.id, s]))
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((s): s is WorkoutSet => s !== undefined)
    if (reordered.length !== block.sets.length) return
    block.sets = reordered
    let order = 0
    await db.sets.bulkPut(blocks.flatMap((b) => b.sets.map((s) => ({ ...s, orderInDay: order++ }))))
  })
}

/** セット属性バンクの入力候補(最近使った順) */
export async function listSetAttributes() {
  const attrs = await db.setAttributes.toArray()
  return attrs.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** セット属性をバンクへ登録する(既存名は lastUsedAt 更新)。クイックボタン設定からの新規作成もここを通す */
export async function upsertSetAttribute(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.transaction('rw', [db.setAttributes], async () => {
    const found = await db.setAttributes.where('name').equals(trimmed).first()
    if (found) {
      await db.setAttributes.update(found.id, { lastUsedAt: Date.now() })
    } else {
      await db.setAttributes.add({ id: crypto.randomUUID(), name: trimmed, lastUsedAt: Date.now() })
    }
  })
}

/**
 * セットに属性を設定する(undefined / 空文字で解除)。
 * 新しい属性名は自動でバンクに登録、既存名は lastUsedAt を更新する
 */
export async function setSetAttribute(setId: string, name: string | undefined): Promise<void> {
  const trimmed = name?.trim()
  await db.transaction('rw', [db.sets, db.setAttributes], async () => {
    if (!trimmed) {
      await db.sets.update(setId, { attribute: undefined })
      return
    }
    await upsertSetAttribute(trimmed)
    await db.sets.update(setId, { attribute: trimmed })
  })
}

/** 記録済みブロック(その日の種目×タグ)のタグを付け替える(全セットに適用) */
export async function changeBlockTag(
  date: string,
  exerciseId: string,
  fromTagId: string,
  toTagId: string,
): Promise<void> {
  if (fromTagId === toTagId) return
  await db.transaction('rw', [db.sets], async () => {
    const sets = await db.sets.where('date').equals(date).toArray()
    const targets = sets.filter((s) => s.exerciseId === exerciseId && s.tagId === fromTagId)
    await db.sets.bulkPut(targets.map((s) => ({ ...s, tagId: toTagId })))
  })
}

// ---- MAX 記録 ----

/**
 * セットの値が種目×タグの過去ベスト(重量 / 推定1RM)を更新したか判定する。
 * 更新していれば通知用メッセージを、していなければ null を返す。
 * ウォームアップ・実績空欄・換算不能な自重は対象外。初記録(過去データなし)は通知しない。
 */
export async function detectMaxUpdate(setId: string): Promise<string | null> {
  const set = await db.sets.get(setId)
  if (!set || set.isWarmup || set.reps <= 0) return null
  const bodyWeight = await getSetting<number>('bodyWeight')
  const load = effectiveLoad(set, bodyWeight)
  if (load === undefined || load <= 0) return null

  const history = await db.sets
    .where('[exerciseId+tagId]')
    .equals([set.exerciseId, set.tagId])
    .toArray()
  const others = history.filter((s) => s.id !== set.id && !s.isWarmup && s.reps > 0)
  if (others.length === 0) return null

  let bestLoad = 0
  let bestRm = 0
  for (const s of others) {
    const l = effectiveLoad(s, bodyWeight)
    if (l === undefined) continue
    bestLoad = Math.max(bestLoad, l)
    bestRm = Math.max(bestRm, estimateOneRepMax(l, s.reps))
  }

  const updates: string[] = []
  if (load > bestLoad) updates.push(`重量 ${Math.round(load * 10) / 10}kg`)
  const rm = estimateOneRepMax(load, set.reps)
  if (rm > bestRm) updates.push(`推定1RM ${Math.round(rm * 10) / 10}kg`)
  if (updates.length === 0) return null

  const exercise = await db.exercises.get(set.exerciseId)
  const tag = set.tagId === NO_TAG ? undefined : await db.tags.get(set.tagId)
  const name = `${exercise?.name ?? ''}${tag ? `(${tag.name})` : ''}`
  return `👑 ${name} ベスト更新! ${updates.join(' / ')}`
}

// ---- テンプレート(トレーニングメニュー) ----

export async function listTemplates() {
  const templates = await db.templates.toArray()
  return templates.sort((a, b) => a.createdAt - b.createdAt)
}

/** その日の記録(種目×タグの並び)をテンプレートとして保存する */
export async function saveTemplateFromDay(date: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('テンプレート名が空です')
  const sets = await listSetsByDate(date)
  const blocks = groupSetsIntoBlocks(sets)
  if (blocks.length === 0) throw new Error('この日に記録がありません')
  const template = {
    id: crypto.randomUUID(),
    name: trimmed,
    items: blocks.map((b) => ({ exerciseId: b.exerciseId, tagId: b.tagId })),
    createdAt: Date.now(),
  }
  await db.templates.add(template)
  return template
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

/**
 * テンプレートを日に展開する。各種目×タグの前回記録をコピーし、
 * 前回がなければデフォルト 1 セットを作る。展開したブロック数を返す
 */
export async function applyTemplate(date: string, templateId: string): Promise<number> {
  const template = await db.templates.get(templateId)
  if (!template) return 0
  for (const item of template.items) {
    // 重量・目標はコピーするが、実績レップはこれから積むので空欄(0)にする
    const copied = await copyPreviousSession(date, item.exerciseId, item.tagId, {
      clearReps: true,
    })
    if (copied === 0) {
      const last = await getLastSet(item.exerciseId, item.tagId)
      await addSet({
        date,
        exerciseId: item.exerciseId,
        tagId: item.tagId,
        weight: last?.weight ?? 20,
        isBodyweight: last?.isBodyweight,
        isWarmup: last?.isWarmup,
        reps: 0,
        targetReps: last?.targetReps,
        unit: last?.unit,
      })
    }
  }
  return template.items.length
}

// ---- マスタ管理(種目・部位・タグ・セット属性) ----

/** 削除の結果。使用中で削除できない場合は usedCount に使用セット数が入る */
export interface DeleteResult {
  deleted: boolean
  usedCount?: number
}

export async function listBodyParts() {
  return db.bodyParts.orderBy('sortOrder').toArray()
}

/** 部位を追加する。同名(トリム後)が既にあればそれを返す */
export async function addBodyPart(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('部位名が空です')
  return db.transaction('rw', [db.bodyParts], async () => {
    const found = await db.bodyParts.where('name').equals(trimmed).first()
    if (found) return found
    const all = await db.bodyParts.toArray()
    const row = {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: all.length ? Math.max(...all.map((p) => p.sortOrder)) + 1 : 0,
    }
    await db.bodyParts.add(row)
    return row
  })
}

/** 種目を追加する。同部位に同名があればそれを返す */
export async function addExercise(name: string, bodyPart: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('種目名が空です')
  return db.transaction('rw', [db.exercises], async () => {
    const found = await db.exercises
      .where('name')
      .equals(trimmed)
      .and((e) => e.bodyPart === bodyPart)
      .first()
    if (found) return found
    const all = await db.exercises.toArray()
    const exercise = {
      id: crypto.randomUUID(),
      name: trimmed,
      bodyPart,
      sortOrder: all.length ? Math.max(...all.map((e) => e.sortOrder)) + 1 : 0,
      isArchived: false,
      createdAt: Date.now(),
    }
    await db.exercises.add(exercise)
    return exercise
  })
}

/** 同じ部位内で種目の並び順を 1 つ上/下へ動かす(sortOrder を入れ替え) */
export async function moveExerciseOrder(id: string, direction: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', [db.exercises], async () => {
    const target = await db.exercises.get(id)
    if (!target) return
    const siblings = (await db.exercises.toArray())
      .filter((e) => e.bodyPart === target.bodyPart)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const index = siblings.findIndex((e) => e.id === id)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return
    const other = siblings[swapWith]
    await db.exercises.bulkPut([
      { ...target, sortOrder: other.sortOrder },
      { ...other, sortOrder: target.sortOrder },
    ])
  })
}

export async function renameExercise(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.exercises.update(id, { name: trimmed })
}

/** 種目を削除する。記録で使用中なら削除せず件数を返す */
export async function deleteExercise(id: string): Promise<DeleteResult> {
  return db.transaction('rw', [db.exercises, db.sets], async () => {
    const usedCount = await db.sets.where('exerciseId').equals(id).count()
    if (usedCount > 0) return { deleted: false, usedCount }
    await db.exercises.delete(id)
    return { deleted: true }
  })
}

/** 種目タグを削除する。記録で使用中なら削除せず件数を返す */
export async function deleteTag(id: string): Promise<DeleteResult> {
  return db.transaction('rw', [db.tags, db.sets], async () => {
    // tagId 単独のインデックスはないので全走査(データ量は数万件想定で問題ない)
    const usedCount = await db.sets.filter((s) => s.tagId === id).count()
    if (usedCount > 0) return { deleted: false, usedCount }
    await db.tags.delete(id)
    return { deleted: true }
  })
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.locations.update(id, { name: trimmed })
}

/** 場所を削除する。日の記録で使用中なら削除せず件数を返す */
export async function deleteLocation(id: string): Promise<DeleteResult> {
  return db.transaction('rw', [db.locations, db.days], async () => {
    const usedCount = await db.days.filter((d) => d.locationId === id).count()
    if (usedCount > 0) return { deleted: false, usedCount }
    await db.locations.delete(id)
    return { deleted: true }
  })
}

/** セット属性をバンクから削除する。記録で使用中なら削除せず件数を返す */
export async function deleteSetAttribute(id: string): Promise<DeleteResult> {
  return db.transaction('rw', [db.setAttributes, db.sets], async () => {
    const attr = await db.setAttributes.get(id)
    if (!attr) return { deleted: true }
    const usedCount = await db.sets.filter((s) => s.attribute === attr.name).count()
    if (usedCount > 0) return { deleted: false, usedCount }
    await db.setAttributes.delete(id)
    return { deleted: true }
  })
}

/** タグを追加する。同名(トリム後)が既にあればそれを返す */
export async function addTag(name: string): Promise<Tag> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('タグ名が空です')
  return db.transaction('rw', [db.tags], async () => {
    const found = await db.tags.where('name').equals(trimmed).first()
    if (found) return found
    const all = await db.tags.toArray()
    const tag: Tag = {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: all.length ? Math.max(...all.map((t) => t.sortOrder)) + 1 : 0,
      isArchived: false,
      createdAt: Date.now(),
    }
    await db.tags.add(tag)
    return tag
  })
}

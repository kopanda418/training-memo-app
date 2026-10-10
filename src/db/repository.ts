import {
  blockKeyString,
  groupSetsIntoBlocks,
  inBlock,
  nextRound,
  roundOf,
  type BlockKey,
} from '../lib/groupSets'
import { estimateOneRepMax } from '../lib/oneRepMax'
import { effectiveLoad } from '../lib/setFormat'
import { db } from './db'
import { getSetting, setSetting } from './settings'
import {
  NO_TAG,
  type BlockNote,
  type Day,
  type Tag,
  type WeightUnit,
  type WorkoutSet,
} from './types'

/**
 * 既定の場所(ホームジム)の id を解決する。未設定・削除済みなら undefined。
 * 日レコードの新規作成時に locationId の初期値として使う(#3)。トランザクション開始前に呼ぶこと。
 */
async function resolveDefaultLocationId(): Promise<string | undefined> {
  const id = await getSetting<string>('defaultLocationId')
  if (!id) return undefined
  const loc = await db.locations.get(id)
  return loc ? id : undefined
}

export interface NewSetInput {
  date: string
  exerciseId: string
  /** 省略時はタグなし */
  tagId?: string
  weight: number
  isBodyweight?: boolean
  isWarmup?: boolean
  reps: number
  rpe?: number
  attributes?: string[]
  isAssisted?: boolean
  unit?: WeightUnit
  memo?: string
  /** 回目(省略 = 0。ADR-015) */
  round?: number
}

/** セットを追加する。日レコードがなければ作り、orderInDay は日内の末尾になる */
export async function addSet(input: NewSetInput): Promise<WorkoutSet> {
  // settings はトランザクション対象外のテーブルなので、開始前に読む
  const unit = input.unit ?? ((await getSetting<WeightUnit>('defaultUnit')) || 'kg')
  const defaultLocationId = await resolveDefaultLocationId()
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
      rpe: input.rpe,
      attributes: input.attributes,
      isAssisted: input.isAssisted ?? false,
      // 単位の優先順: 明示指定(前セット引き継ぎ) > 設定のデフォルト > kg
      unit,
      memo: input.memo,
      orderInDay,
      round: input.round || undefined,
      createdAt: Date.now(),
    }
    await db.sets.add(set)
    await ensureDay(input.date, defaultLocationId)
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
      | 'rpe'
      | 'attributes'
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
  await db.transaction('rw', [db.sets, db.blockNotes], async () => {
    const set = await db.sets.get(id)
    await db.sets.delete(id)
    if (!set) return
    // このブロック(その日のその種目×タグ×回目)が空になったら孤児メモを消す
    const key: BlockKey = { exerciseId: set.exerciseId, tagId: set.tagId, round: roundOf(set) }
    const remaining = await db.sets
      .where('[exerciseId+tagId]')
      .equals([set.exerciseId, set.tagId])
      .and((s) => s.date === set.date && inBlock(s, key))
      .count()
    if (remaining === 0) await db.blockNotes.delete(noteKey(set.date, key))
  })
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

/**
 * 日レコードを保証する。無ければ作る。
 * 新規作成時のみ、defaultLocationId が渡されていれば既定の場所を付与する(#3)。
 * 既存の日には触れない(= 記録がある日の場所を上書きしない)。
 */
async function ensureDay(date: string, defaultLocationId?: string): Promise<Day> {
  const existing = await db.days.get(date)
  if (existing) return existing
  const day: Day = { date, locationId: defaultLocationId }
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
      const all = await db.locations.toArray()
      const sortOrder = all.length ? Math.max(...all.map((l) => l.sortOrder ?? 0)) + 1 : 0
      await db.locations.add({ id: locationId, name: trimmed, lastUsedAt: now, sortOrder })
    }
    await db.days.update(date, { locationId })
  })
}

/**
 * その日のトレーニング全体の感想メモを設定する。
 * 空文字ならメモを消す(undefined)。日レコードがなければ作る。
 */
export async function setDayNote(date: string, note: string): Promise<void> {
  const trimmed = note.trim()
  await db.transaction('rw', [db.days], async () => {
    await ensureDay(date)
    await db.days.update(date, { note: trimmed || undefined })
  })
}

// ---- 種目×タグ×回目ブロックの感想メモ(blockNotes) ----

type NoteKey = [string, string, string, number]

const noteKey = (date: string, b: BlockKey): NoteKey => [date, b.exerciseId, b.tagId, b.round]

/** 2 つのブロックメモを合流する(キー衝突時)。両方あれば改行連結、同一なら 1 つに畳む */
function mergeNotes(a: string | undefined, b: string | undefined): string | undefined {
  const x = a?.trim() || undefined
  const y = b?.trim() || undefined
  if (!x) return y
  if (!y || x === y) return x
  return `${x}\n${y}`
}

/** ブロック(種目×タグ×回目)の感想メモを取得する */
export async function getBlockNote(date: string, block: BlockKey): Promise<BlockNote | undefined> {
  return db.blockNotes.get(noteKey(date, block))
}

/**
 * ブロック(種目×タグ)の感想メモ(ユーザー欄 note)を設定する。
 * 空文字なら note を落とし、プラン欄(planNote)も無ければ行ごと削除する。
 * プラン欄は決して書き換えない(ADR-013)。
 */
export async function setBlockNote(date: string, block: BlockKey, note: string): Promise<void> {
  const trimmed = note.trim()
  const key = noteKey(date, block)
  await db.transaction('rw', [db.blockNotes], async () => {
    const existing = await db.blockNotes.get(key)
    if (!trimmed) {
      if (existing?.planNote) {
        await db.blockNotes.put({ ...existing, note: undefined })
      } else {
        await db.blockNotes.delete(key)
      }
      return
    }
    await db.blockNotes.put({
      ...existing,
      date,
      exerciseId: block.exerciseId,
      tagId: block.tagId,
      round: block.round,
      note: trimmed,
    })
  })
}

/** 指定日の全ブロックメモ(履歴日サマリ用) */
export async function listBlockNotesByDate(date: string): Promise<BlockNote[]> {
  return db.blockNotes.where('date').equals(date).toArray()
}

/** 指定種目の全ブロックメモ(種目別履歴用)。exerciseId 単独インデックスはないので全走査(件数は小さい) */
export async function listBlockNotesByExercise(exerciseId: string): Promise<BlockNote[]> {
  return db.blockNotes.filter((n) => n.exerciseId === exerciseId).toArray()
}

/**
 * ブロックメモのキーを付け替える(タグ/種目変更・別日移動の追従に使う)。
 * 移動元にメモが無ければ何もしない。移動先に既存メモがあれば mergeNotes で合流する。
 * copy=true なら移動元を残す(コピー)。呼び出しトランザクションに db.blockNotes を含めること。
 */
async function rekeyBlockNote(from: NoteKey, to: NoteKey, copy = false): Promise<void> {
  const src = await db.blockNotes.get(from)
  if (!src) return
  const dest = await db.blockNotes.get(to)
  await db.blockNotes.put({
    date: to[0],
    exerciseId: to[1],
    tagId: to[2],
    round: to[3],
    note: mergeNotes(dest?.note, src.note),
    planNote: mergeNotes(dest?.planNote, src.planNote),
  })
  if (!copy) await db.blockNotes.delete(from)
}

/** 場所の入力候補(sortOrder 順、未設定は lastUsedAt 降順) */
export async function listLocations() {
  const locations = await db.locations.toArray()
  return locations.sort(
    (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || b.lastUsedAt - a.lastUsedAt,
  )
}

/** 場所を追加する(同名が既にあれば何もしない) */
export async function addLocation(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.transaction('rw', [db.locations], async () => {
    const found = await db.locations.where('name').equals(trimmed).first()
    if (found) return
    const all = await db.locations.toArray()
    const sortOrder = all.length ? Math.max(...all.map((l) => l.sortOrder ?? 0)) + 1 : 0
    await db.locations.add({
      id: crypto.randomUUID(),
      name: trimmed,
      lastUsedAt: Date.now(),
      sortOrder,
    })
  })
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
 * 種目×タグの「前回(targetDate より前の直近の日)」のセットを targetDate 末尾にコピーする。
 * 前回の日に同じ回目(options.round、省略 0)のブロックがあればそれを、無ければ最初のブロックを
 * コピーし、コピー先の回目は options.round になる。コピーしたセット数を返す(前回記録がなければ 0)
 */
export async function copyPreviousSession(
  targetDate: string,
  exerciseId: string,
  tagId: string = NO_TAG,
  options?: { clearReps?: boolean; round?: number },
): Promise<number> {
  const round = options?.round ?? 0
  const defaultLocationId = await resolveDefaultLocationId()
  return db.transaction('rw', [db.sets, db.days], async () => {
    const history = await db.sets.where('[exerciseId+tagId]').equals([exerciseId, tagId]).toArray()
    const prevDates = history.filter((s) => s.date < targetDate).map((s) => s.date)
    if (!prevDates.length) return 0
    const sourceDate = prevDates.sort()[prevDates.length - 1]
    const sourceDay = history
      .filter((s) => s.date === sourceDate)
      .sort((a, b) => a.orderInDay - b.orderInDay)
    const sourceRound = sourceDay.some((s) => roundOf(s) === round) ? round : roundOf(sourceDay[0])
    const sourceSets = sourceDay.filter((s) => roundOf(s) === sourceRound)

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
        round: round || undefined,
        orderInDay: order++,
        createdAt: now,
      })),
    )
    await ensureDay(targetDate, defaultLocationId)
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
  /** 指定すると、そのブロック(種目×タグ×回目)だけを対象にする(未指定なら日全体) */
  block?: BlockKey
}

/**
 * 記録を別の日へコピー/移動する(日全体またはブロック単位)。
 * 移動先に同じ種目×タグが既にあっても合流させず、空いている回目を振って末尾に足す(ADR-015)。
 * 移動元/先は 1 トランザクション。移動でセットが空になった日は days レコードも削除する。
 * 対象セット数を返す。
 */
export async function transferSets(options: TransferOptions): Promise<number> {
  const { fromDate, toDate, mode, block } = options
  if (fromDate === toDate) return 0
  const defaultLocationId = await resolveDefaultLocationId()
  return db.transaction('rw', [db.sets, db.days, db.blockNotes], async () => {
    let source = await loadDaySorted(fromDate)
    if (block) source = source.filter((s) => inBlock(s, block))
    if (!source.length) return 0

    const existing = await db.sets.where('date').equals(toDate).toArray()
    let order = existing.length ? Math.max(...existing.map((s) => s.orderInDay)) + 1 : 0

    // 移動元の各ブロックに、移動先で空いている回目を割り当てる
    const sourceBlocks = groupSetsIntoBlocks(source)
    const taken: BlockKey[] = existing.map((s) => ({ ...s, round: roundOf(s) }))
    const roundMap = new Map<string, number>()
    for (const b of sourceBlocks) {
      const round = nextRound(taken, b.exerciseId, b.tagId)
      roundMap.set(blockKeyString(b), round)
      taken.push({ exerciseId: b.exerciseId, tagId: b.tagId, round })
    }
    const destRound = (s: WorkoutSet) =>
      roundMap.get(
        blockKeyString({ exerciseId: s.exerciseId, tagId: s.tagId, round: roundOf(s) }),
      ) ?? 0

    const moved = source.map((s) => ({
      ...s,
      date: toDate,
      round: destRound(s) || undefined,
      orderInDay: order++,
    }))
    if (mode === 'copy') {
      const now = Date.now()
      await db.sets.bulkAdd(moved.map((s) => ({ ...s, id: crypto.randomUUID(), createdAt: now })))
    } else {
      await db.sets.bulkPut(moved)
      const remaining = await db.sets.where('date').equals(fromDate).count()
      if (remaining === 0) await db.days.delete(fromDate)
    }

    // ブロックメモを移動先へ追従させる(move=付け替え、copy=複製)
    for (const b of sourceBlocks) {
      const to: BlockKey = { ...b, round: roundMap.get(blockKeyString(b)) ?? 0 }
      await rekeyBlockNote(noteKey(fromDate, b), noteKey(toDate, to), mode === 'copy')
    }

    await ensureDay(toDate, defaultLocationId)
    return source.length
  })
}

/** 日の全セットを表示順で読む(ブロック操作の共通前処理) */
async function loadDaySorted(date: string): Promise<WorkoutSet[]> {
  return (await db.sets.where('date').equals(date).toArray()).sort(
    (a, b) => a.orderInDay - b.orderInDay,
  )
}

/** ブロック並びどおりに orderInDay を 0 から振り直して保存する */
async function saveBlockOrder(blocks: { sets: WorkoutSet[] }[]): Promise<void> {
  let order = 0
  await db.sets.bulkPut(blocks.flatMap((b) => b.sets.map((s) => ({ ...s, orderInDay: order++ }))))
}

/**
 * 日のブロック(種目×タグ×回目)を丸ごと削除する(全セット+ブロックメモ)。
 * 日のメモ・場所(days)は残す。残ったブロックの orderInDay は振り直す。削除したセット数を返す
 */
export async function deleteBlockInDay(date: string, block: BlockKey): Promise<number> {
  return db.transaction('rw', [db.sets, db.blockNotes], async () => {
    const sets = await loadDaySorted(date)
    const target = sets.filter((s) => inBlock(s, block))
    if (!target.length) return 0
    await db.sets.bulkDelete(target.map((s) => s.id))
    await db.blockNotes.delete(noteKey(date, block))
    await saveBlockOrder([{ sets: sets.filter((s) => !inBlock(s, block)) }])
    return target.length
  })
}

/** 日の中でブロックの表示順を 1 つ上/下、または先頭/末尾へ移動する(orderInDay を振り直す) */
export async function moveBlockInDay(
  date: string,
  block: BlockKey,
  direction: 'up' | 'down' | 'top' | 'bottom',
): Promise<void> {
  await db.transaction('rw', [db.sets], async () => {
    const blocks = groupSetsIntoBlocks(await loadDaySorted(date))
    const key = blockKeyString(block)
    const index = blocks.findIndex((b) => blockKeyString(b) === key)
    if (index < 0) return
    const to =
      direction === 'top'
        ? 0
        : direction === 'bottom'
          ? blocks.length - 1
          : direction === 'up'
            ? index - 1
            : index + 1
    if (to < 0 || to >= blocks.length || to === index) return
    const [moved] = blocks.splice(index, 1)
    blocks.splice(to, 0, moved)
    await saveBlockOrder(blocks)
  })
}

/**
 * 日のブロックを指定順に並べ替える(並べ替え画面のドラッグ結果)。
 * orderedKeys は blockKeyString(`${exerciseId}|${tagId}|${round}`)。含まれないブロックは元の相対順で末尾に残す
 */
export async function reorderBlocksInDay(date: string, orderedKeys: string[]): Promise<void> {
  await db.transaction('rw', [db.sets], async () => {
    const blocks = groupSetsIntoBlocks(await loadDaySorted(date))
    const rank = new Map(orderedKeys.map((k, i) => [k, i]))
    const sorted = blocks
      .map((b, i) => ({ b, r: rank.get(blockKeyString(b)) ?? orderedKeys.length + i }))
      .sort((x, y) => x.r - y.r)
      .map((x) => x.b)
    await saveBlockOrder(sorted)
  })
}

/** ブロック内のセットを指定順に並べ替える(orderInDay を日全体で振り直す) */
export async function reorderSetsInBlock(
  date: string,
  block: BlockKey,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', [db.sets], async () => {
    const blocks = groupSetsIntoBlocks(await loadDaySorted(date))
    const key = blockKeyString(block)
    const target = blocks.find((b) => blockKeyString(b) === key)
    if (!target) return
    const byId = new Map(target.sets.map((s) => [s.id, s]))
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((s): s is WorkoutSet => s !== undefined)
    if (reordered.length !== target.sets.length) return
    target.sets = reordered
    await saveBlockOrder(blocks)
  })
}

/** セット属性バンクの入力候補(最近使った順) */
/** セット属性の候補(sortOrder 順、未設定は lastUsedAt 降順) */
export async function listSetAttributes() {
  const attrs = await db.setAttributes.toArray()
  return attrs.sort(
    (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || b.lastUsedAt - a.lastUsedAt,
  )
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
      const all = await db.setAttributes.toArray()
      const sortOrder = all.length ? Math.max(...all.map((a) => a.sortOrder ?? 0)) + 1 : 0
      await db.setAttributes.add({
        id: crypto.randomUUID(),
        name: trimmed,
        lastUsedAt: Date.now(),
        sortOrder,
      })
    }
  })
}

/**
 * セットの属性を 1 つトグルする(付いていなければ追加、付いていれば外す)。
 * 追加時は自動でバンクに登録する。属性は複数持てる
 */
export async function toggleSetAttribute(setId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.transaction('rw', [db.sets, db.setAttributes], async () => {
    const set = await db.sets.get(setId)
    if (!set) return
    const current = set.attributes ?? []
    let next: string[] | undefined
    if (current.includes(trimmed)) {
      next = current.filter((a) => a !== trimmed)
      if (next.length === 0) next = undefined
    } else {
      next = [...current, trimmed]
      await upsertSetAttribute(trimmed)
    }
    await db.sets.update(setId, { attributes: next })
  })
}

/**
 * 記録済みブロックの種目またはタグを付け替える(全セットに適用、位置はそのまま)。
 * 付け替え先に同じ種目×タグが既にあっても合流させず、空いている回目を振る(ADR-015)
 */
async function relabelBlock(
  date: string,
  block: BlockKey,
  to: { exerciseId: string; tagId: string },
): Promise<void> {
  if (to.exerciseId === block.exerciseId && to.tagId === block.tagId) return
  await db.transaction('rw', [db.sets, db.blockNotes], async () => {
    const daySets = await db.sets.where('date').equals(date).toArray()
    const targets = daySets.filter((s) => inBlock(s, block))
    if (!targets.length) return
    const round = nextRound(daySets, to.exerciseId, to.tagId)
    await db.sets.bulkPut(targets.map((s) => ({ ...s, ...to, round: round || undefined })))
    await rekeyBlockNote(noteKey(date, block), noteKey(date, { ...to, round }))
  })
}

/** 記録済みブロックのタグを付け替える */
export async function changeBlockTag(date: string, block: BlockKey, toTagId: string) {
  await relabelBlock(date, block, { exerciseId: block.exerciseId, tagId: toTagId })
}

/** 記録済みブロックの種目を付け替える */
export async function changeBlockExercise(date: string, block: BlockKey, toExerciseId: string) {
  await relabelBlock(date, block, { exerciseId: toExerciseId, tagId: block.tagId })
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
    // 同じ日に同じ種目×タグが既にあれば別の回目として足す(ADR-015)
    const round = nextRound(await listSetsByDate(date), item.exerciseId, item.tagId)
    // 重量・目標はコピーするが、実績レップはこれから積むので空欄(0)にする
    const copied = await copyPreviousSession(date, item.exerciseId, item.tagId, {
      clearReps: true,
      round,
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
        rpe: last?.rpe,
        attributes: last?.attributes,
        unit: last?.unit,
        round,
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
  const result = await db.transaction('rw', [db.locations, db.days], async () => {
    const usedCount = await db.days.filter((d) => d.locationId === id).count()
    if (usedCount > 0) return { deleted: false, usedCount }
    await db.locations.delete(id)
    return { deleted: true }
  })
  // 既定の場所(ホームジム)に指定されていた場合は設定を解除する(#3)
  if (result.deleted && (await getSetting<string>('defaultLocationId')) === id) {
    await setSetting('defaultLocationId', '')
  }
  return result
}

/** セット属性をバンクから削除する。記録で使用中なら削除せず件数を返す */
export async function deleteSetAttribute(id: string): Promise<DeleteResult> {
  return db.transaction('rw', [db.setAttributes, db.sets], async () => {
    const attr = await db.setAttributes.get(id)
    if (!attr) return { deleted: true }
    const usedCount = await db.sets.filter((s) => !!s.attributes?.includes(attr.name)).count()
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

/** 種目タグの並び順を一括更新(orderedIds の順に sortOrder を 0,1,2... と振り直す) */
export async function reorderTags(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', [db.tags], async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.tags.update(orderedIds[i], { sortOrder: i })
    }
  })
}

/** 場所の並び順を一括更新 */
export async function reorderLocations(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', [db.locations], async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.locations.update(orderedIds[i], { sortOrder: i })
    }
  })
}

/** セット属性の並び順を一括更新 */
export async function reorderSetAttributes(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', [db.setAttributes], async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.setAttributes.update(orderedIds[i], { sortOrder: i })
    }
  })
}

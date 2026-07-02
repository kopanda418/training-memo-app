import { db } from './db'
import { NO_TAG, type Day, type WeightUnit, type WorkoutSet } from './types'

export interface NewSetInput {
  date: string
  exerciseId: string
  /** 省略時はタグなし */
  tagId?: string
  weight: number
  reps: number
  isAssisted?: boolean
  unit?: WeightUnit
  memo?: string
}

/** セットを追加する。日レコードがなければ作り、orderInDay は日内の末尾になる */
export async function addSet(input: NewSetInput): Promise<WorkoutSet> {
  return db.transaction('rw', [db.sets, db.days], async () => {
    const existing = await db.sets.where('date').equals(input.date).toArray()
    const orderInDay = existing.length ? Math.max(...existing.map((s) => s.orderInDay)) + 1 : 0
    const set: WorkoutSet = {
      id: crypto.randomUUID(),
      date: input.date,
      exerciseId: input.exerciseId,
      tagId: input.tagId ?? NO_TAG,
      weight: input.weight,
      reps: input.reps,
      isAssisted: input.isAssisted ?? false,
      unit: input.unit ?? 'kg',
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
  changes: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'isAssisted' | 'unit' | 'memo' | 'tagId'>>,
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

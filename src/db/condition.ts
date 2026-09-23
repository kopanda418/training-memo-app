import { addDays } from '../lib/date'
import { db } from './db'
import type { DailyCondition, PainRecord } from './types'

// ---- 体調・やる気・痛み(ADR-014) ----

export async function getCondition(date: string): Promise<DailyCondition | undefined> {
  return db.conditions.get(date)
}

/** 体調/やる気のスコア(1〜10)を設定する。undefined で解除。両方未設定になれば行ごと消す */
export async function setConditionScore(
  date: string,
  field: 'condition' | 'motivation',
  value: number | undefined,
): Promise<void> {
  await db.transaction('rw', [db.conditions], async () => {
    const current: DailyCondition = (await db.conditions.get(date)) ?? { date }
    const next: DailyCondition = { ...current, [field]: value }
    if (next.condition === undefined && next.motivation === undefined) {
      await db.conditions.delete(date)
    } else {
      await db.conditions.put(next)
    }
  })
}

export async function listPainsByDate(date: string): Promise<PainRecord[]> {
  const rows = await db.painRecords.where('date').equals(date).toArray()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export type PainInput = Omit<PainRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

/**
 * 痛みを保存する。id があればその行を更新。
 * id が無くても同じ日×部位×左右の記録があればそれを更新する(1 日 1 部位×左右 1 件)
 */
export async function savePain(input: PainInput): Promise<PainRecord> {
  return db.transaction('rw', [db.painRecords], async () => {
    const now = Date.now()
    const { id, ...fields } = input
    const existing = id
      ? await db.painRecords.get(id)
      : await db.painRecords
          .where('[area+side]')
          .equals([input.area, input.side])
          .filter((p) => p.date === input.date)
          .first()
    const note = fields.note?.trim() || undefined
    // 編集で左右・部位を変えた結果、同じ日×部位×左右の別レコードと重なったら編集側に一本化する
    const clash = await db.painRecords
      .where('[area+side]')
      .equals([input.area, input.side])
      .filter((p) => p.date === input.date && p.id !== existing?.id)
      .first()
    if (existing && clash) await db.painRecords.delete(clash.id)
    if (existing) {
      const updated: PainRecord = { ...existing, ...fields, note, updatedAt: now }
      await db.painRecords.put(updated)
      return updated
    }
    const created: PainRecord = {
      ...fields,
      note,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    await db.painRecords.add(created)
    return created
  })
}

export async function deletePain(id: string): Promise<void> {
  await db.painRecords.delete(id)
}

export const painKey = (p: Pick<PainRecord, 'area' | 'side'>) => `${p.area}|${p.side}`

/**
 * 「続いている痛み」: date より前 lookbackDays 日以内に記録があり、最後の強さが 1 以上で、
 * date にはまだ記録していない部位×左右の、最新レコード
 */
export async function listOngoingPains(date: string, lookbackDays = 14): Promise<PainRecord[]> {
  const [recent, today] = await Promise.all([
    db.painRecords.where('date').between(addDays(date, -lookbackDays), date, true, false).toArray(),
    db.painRecords.where('date').equals(date).toArray(),
  ])
  const recordedToday = new Set(today.map(painKey))
  const latest = new Map<string, PainRecord>()
  for (const p of recent) {
    const cur = latest.get(painKey(p))
    if (!cur || p.date > cur.date) latest.set(painKey(p), p)
  }
  return [...latest.values()]
    .filter((p) => p.intensity > 0 && !recordedToday.has(painKey(p)))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export interface PainGroup {
  area: string
  side: PainRecord['side']
  /** 日付の古い順 */
  records: PainRecord[]
}

/** 痛みの経過: 部位×左右ごとにまとめ、最後に記録した日の新しい順で返す */
export async function listPainGroups(): Promise<PainGroup[]> {
  const all = await db.painRecords.orderBy('date').toArray()
  const groups = new Map<string, PainGroup>()
  for (const p of all) {
    const key = painKey(p)
    let g = groups.get(key)
    if (!g) {
      g = { area: p.area, side: p.side, records: [] }
      groups.set(key, g)
    }
    g.records.push(p)
  }
  return [...groups.values()].sort((a, b) =>
    b.records[b.records.length - 1].date.localeCompare(a.records[a.records.length - 1].date),
  )
}

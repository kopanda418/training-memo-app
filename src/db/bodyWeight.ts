import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { makeBodyWeightOf, type BodyWeightOf } from '../lib/bodyWeight'
import { db } from './db'
import { getSetting, useSetting } from './settings'

// ---- 日ごとの体重(ADR-017) ----

export async function getBodyWeight(date: string): Promise<number | undefined> {
  return (await db.bodyWeights.get(date))?.weight
}

/** その日の体重を設定する(1 日 1 件で上書き)。undefined で削除 */
export async function setBodyWeight(date: string, weight: number | undefined): Promise<void> {
  if (weight === undefined) await db.bodyWeights.delete(date)
  else await db.bodyWeights.put({ date, weight })
}

/** 体重の記録を日付昇順で返す */
export async function listBodyWeights() {
  return db.bodyWeights.orderBy('date').toArray()
}

/** 自重換算用の「日付 → 体重」関数(DB 版。MAX 更新判定など UI 外で使う) */
export async function loadBodyWeightOf(): Promise<BodyWeightOf> {
  const [entries, fallback] = await Promise.all([
    listBodyWeights(),
    getSetting<number>('bodyWeight'),
  ])
  return makeBodyWeightOf(entries, fallback)
}

/** 自重換算用の「日付 → 体重」関数を購読する(記録・設定の変更は即反映) */
export function useBodyWeightOf(): BodyWeightOf {
  const entries = useLiveQuery(listBodyWeights, [])
  const fallback = useSetting<number>('bodyWeight')
  return useMemo(() => makeBodyWeightOf(entries ?? [], fallback), [entries, fallback])
}

/** 1 日分の換算用体重を購読する(記録画面のセット行など、日付が 1 つに決まる場面用) */
export function useBodyWeightOn(date: string): number | undefined {
  const recorded = useLiveQuery(
    async () => (await db.bodyWeights.where('date').belowOrEqual(date).last())?.weight ?? null,
    [date],
  )
  const fallback = useSetting<number>('bodyWeight')
  return recorded ?? fallback
}

/** その日より前の直近の体重記録 */
export async function getPreviousBodyWeight(date: string) {
  return db.bodyWeights.where('date').below(date).last()
}

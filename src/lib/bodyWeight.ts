import type { BodyWeight } from '../db/types'

/** 日付 → その日に使う体重(kg)。換算できなければ undefined */
export type BodyWeightOf = (date: string) => number | undefined

/** 固定値(設定の体重)または日付ごとの体重。集計関数はどちらでも受け取れる */
export type BodyWeightSource = number | BodyWeightOf | undefined

export function bodyWeightAt(source: BodyWeightSource, date: string): number | undefined {
  return typeof source === 'function' ? source(date) : source
}

/** 体重の入力値を検証して小数第二位に丸める。不正なら undefined */
export function parseBodyWeight(text: string): number | undefined {
  const n = Number(text.trim())
  if (text.trim() === '' || !Number.isFinite(n) || n <= 0 || n >= 1000) return undefined
  return Math.round(n * 100) / 100
}

/**
 * 自重セットの換算に使う体重(ADR-017)。その日の記録 → それより前の直近の記録 →
 * fallback(設定の体重)の順に使う
 */
export function makeBodyWeightOf(entries: readonly BodyWeight[], fallback?: number): BodyWeightOf {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return (date) => {
    // date 以下で最大の日付を二分探索
    let lo = 0
    let hi = sorted.length - 1
    let found: BodyWeight | undefined
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid].date <= date) {
        found = sorted[mid]
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return found?.weight ?? fallback
  }
}

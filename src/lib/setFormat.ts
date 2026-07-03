import type { WorkoutSet } from '../db/types'

type WeightPart = Pick<WorkoutSet, 'weight' | 'unit' | 'isBodyweight'>

/** セットの重量表示: "100kg" / "自重" / "自重+10kg" */
export function formatSetWeight(set: WeightPart): string {
  if (set.isBodyweight) {
    return set.weight > 0 ? `自重+${set.weight}${set.unit}` : '自重'
  }
  return `${set.weight}${set.unit}`
}

/**
 * 1RM 換算に使う実効負荷。
 * 自重セットは「体重 + 加重」(体重未登録なら換算不能 = undefined)。
 * 加重セットはそのままの重量。
 */
export function effectiveLoad(set: WeightPart, bodyWeight?: number): number | undefined {
  if (!set.isBodyweight) return set.weight
  if (bodyWeight && bodyWeight > 0) return bodyWeight + set.weight
  return undefined
}

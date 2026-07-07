/**
 * 推定 1RM(O'Conner 式)。reps = 1 のときは weight そのもの。
 * 式の変更は ADR-007 を更新してから行う。
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 40)
}

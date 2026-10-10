import type { WorkoutSet } from '../db/types'

/** 1 日の中のブロックを識別するキー(種目×タグ×回目。ADR-015) */
export interface BlockKey {
  exerciseId: string
  tagId: string
  /** 回目(0 = その日の 1 つ目) */
  round: number
}

export interface SetBlock extends BlockKey {
  sets: WorkoutSet[]
}

export const roundOf = (s: Pick<WorkoutSet, 'round'>): number => s.round ?? 0

export const blockKeyString = (b: BlockKey): string => `${b.exerciseId}|${b.tagId}|${b.round}`

/** セットが指定ブロックに属するか */
export const inBlock = (s: WorkoutSet, b: BlockKey): boolean =>
  s.exerciseId === b.exerciseId && s.tagId === b.tagId && roundOf(s) === b.round

/** 種目×タグの次の回目(その日の既存の最大 + 1。無ければ 0) */
export function nextRound(
  daySets: Pick<WorkoutSet, 'exerciseId' | 'tagId' | 'round'>[],
  exerciseId: string,
  tagId: string,
): number {
  const rounds = daySets
    .filter((s) => s.exerciseId === exerciseId && s.tagId === tagId)
    .map((s) => s.round ?? 0)
  return rounds.length ? Math.max(...rounds) + 1 : 0
}

/** 1 日分のセット(orderInDay 順)を種目×タグ×回目のブロックに分ける。ブロック順は初出順 */
export function groupSetsIntoBlocks(sets: WorkoutSet[]): SetBlock[] {
  const map = new Map<string, SetBlock>()
  for (const s of sets) {
    const key: BlockKey = { exerciseId: s.exerciseId, tagId: s.tagId, round: roundOf(s) }
    const keyString = blockKeyString(key)
    let block = map.get(keyString)
    if (!block) {
      block = { ...key, sets: [] }
      map.set(keyString, block)
    }
    block.sets.push(s)
  }
  return [...map.values()]
}

/**
 * 表示用の「n回目」ラベル(並び順で 1 から振る)。同じ種目×タグが 1 つしかないブロックは undefined
 */
export function roundLabels(blocks: BlockKey[]): (string | undefined)[] {
  const total = new Map<string, number>()
  for (const b of blocks) {
    const k = `${b.exerciseId}|${b.tagId}`
    total.set(k, (total.get(k) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  return blocks.map((b) => {
    const k = `${b.exerciseId}|${b.tagId}`
    if ((total.get(k) ?? 0) < 2) return undefined
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    return `${n}回目`
  })
}

import type { WorkoutSet } from '../db/types'

export interface SetBlock {
  exerciseId: string
  tagId: string
  sets: WorkoutSet[]
}

/** 1 日分のセット(orderInDay 順)を種目×タグのブロックに分ける。ブロック順は初出順 */
export function groupSetsIntoBlocks(sets: WorkoutSet[]): SetBlock[] {
  const map = new Map<string, SetBlock>()
  for (const s of sets) {
    const key = `${s.exerciseId}|${s.tagId}`
    let block = map.get(key)
    if (!block) {
      block = { exerciseId: s.exerciseId, tagId: s.tagId, sets: [] }
      map.set(key, block)
    }
    block.sets.push(s)
  }
  return [...map.values()]
}

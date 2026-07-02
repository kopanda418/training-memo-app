import Dexie, { type Table } from 'dexie'
import { buildDefaultExercises, buildDefaultTags } from './seed'
import type { Day, Exercise, Location, Setting, Tag, WorkoutSet } from './types'

/**
 * スキーマ変更時は version(n+1).stores(...).upgrade(...) を「追加」し、
 * docs/architecture.md のデータモデル表を同時に更新すること。
 */
export class TrainingMemoDB extends Dexie {
  exercises!: Table<Exercise, string>
  tags!: Table<Tag, string>
  days!: Table<Day, string>
  sets!: Table<WorkoutSet, string>
  locations!: Table<Location, string>
  settings!: Table<Setting, string>

  constructor() {
    super('training-memo')
    this.version(1).stores({
      exercises: 'id, name, bodyPart, sortOrder',
      tags: 'id, name, sortOrder',
      days: 'date',
      sets: 'id, date, [exerciseId+tagId], exerciseId',
      locations: 'id, name',
      settings: 'key',
    })
    // 初回作成時のみデフォルトマスタを投入
    this.on('populate', () => {
      void this.exercises.bulkAdd(buildDefaultExercises())
      void this.tags.bulkAdd(buildDefaultTags())
    })
  }
}

export const db = new TrainingMemoDB()

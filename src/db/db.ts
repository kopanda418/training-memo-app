import Dexie, { type Table } from 'dexie'
import { buildDefaultBodyParts, buildDefaultExercises, buildDefaultTags } from './seed'
import type {
  BodyPartRow,
  Day,
  Exercise,
  Location,
  SetAttribute,
  Setting,
  Tag,
  WorkoutSet,
} from './types'

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
  setAttributes!: Table<SetAttribute, string>
  bodyParts!: Table<BodyPartRow, string>

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
    // v2: セット属性バンクを追加し、旧「補助」フラグを属性へ移行
    this.version(2)
      .stores({
        setAttributes: 'id, name',
      })
      .upgrade(async (tx) => {
        const sets = tx.table<WorkoutSet, string>('sets')
        const assisted = await sets.filter((s) => s.isAssisted === true && !s.attribute).toArray()
        if (assisted.length === 0) return
        await Promise.all(assisted.map((s) => sets.update(s.id, { attribute: '補助' })))
        await tx.table<SetAttribute, string>('setAttributes').add({
          id: crypto.randomUUID(),
          name: '補助',
          lastUsedAt: Date.now(),
        })
      })
    // v3: 部位マスタを追加(追加可能にするため固定配列からテーブルへ)
    this.version(3)
      .stores({
        bodyParts: 'id, name, sortOrder',
      })
      .upgrade(async (tx) => {
        await tx.table<BodyPartRow, string>('bodyParts').bulkAdd(buildDefaultBodyParts())
      })
    // 初回作成時のみデフォルトマスタを投入
    this.on('populate', () => {
      void this.exercises.bulkAdd(buildDefaultExercises())
      void this.tags.bulkAdd(buildDefaultTags())
      void this.bodyParts.bulkAdd(buildDefaultBodyParts())
    })
  }
}

export const db = new TrainingMemoDB()

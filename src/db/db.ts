import Dexie, { type Table } from 'dexie'
import { buildDefaultBodyParts, buildDefaultExercises, buildDefaultTags } from './seed'
import type {
  BlockNote,
  BodyPartRow,
  Day,
  Exercise,
  Location,
  SetAttribute,
  Setting,
  Tag,
  Template,
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
  templates!: Table<Template, string>
  blockNotes!: Table<BlockNote, [string, string, string]>

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
          sortOrder: 0,
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
    // v4: トレーニングメニューのテンプレート
    this.version(4).stores({
      templates: 'id, name',
    })
    // v5: セット属性を単数 attribute → 複数 attributes[] へ移行
    this.version(5).upgrade(async (tx) => {
      const sets = tx.table<WorkoutSet, string>('sets')
      const withAttr = await sets
        .filter((s) => typeof s.attribute === 'string' && s.attribute.length > 0)
        .toArray()
      await Promise.all(
        withAttr.map((s) =>
          sets.update(s.id, { attributes: [s.attribute!], attribute: undefined }),
        ),
      )
    })
    // v6: Location・SetAttribute に sortOrder を追加(旧データは lastUsedAt 降順で初期化)
    this.version(6).upgrade(async (tx) => {
      const locs = await tx.table<Location, string>('locations').toArray()
      locs.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      await Promise.all(locs.map((l, i) => tx.table('locations').update(l.id, { sortOrder: i })))

      const attrs = await tx.table<SetAttribute, string>('setAttributes').toArray()
      attrs.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      await Promise.all(
        attrs.map((a, i) => tx.table('setAttributes').update(a.id, { sortOrder: i })),
      )
    })
    // v7: 種目×タグブロックの感想メモ(days.note とは別立て。複合主キー)
    this.version(7).stores({
      blockNotes: '[date+exerciseId+tagId], date',
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

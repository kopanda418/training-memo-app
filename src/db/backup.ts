import { db } from './db'
import { buildDefaultBodyParts } from './seed'
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

/** エクスポート JSON の形式バージョン。互換性が壊れる変更をしたら上げる */
export const BACKUP_FORMAT_VERSION = 1

export interface BackupFile {
  app: 'training-memo-app'
  formatVersion: number
  exportedAt: string
  data: {
    exercises: Exercise[]
    tags: Tag[]
    days: Day[]
    sets: WorkoutSet[]
    locations: Location[]
    settings: Setting[]
    /** v2 で追加(旧バックアップには無いので省略可) */
    setAttributes?: SetAttribute[]
    /** v3 で追加(旧バックアップには無いので省略可) */
    bodyParts?: BodyPartRow[]
    /** v4 で追加(旧バックアップには無いので省略可) */
    templates?: Template[]
    /** v7 で追加(旧バックアップには無いので省略可) */
    blockNotes?: BlockNote[]
  }
}

/** 全テーブルをバックアップ用オブジェクトに書き出す */
export async function exportData(): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => ({
    app: 'training-memo-app' as const,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      exercises: await db.exercises.toArray(),
      tags: await db.tags.toArray(),
      days: await db.days.toArray(),
      sets: await db.sets.toArray(),
      locations: await db.locations.toArray(),
      settings: await db.settings.toArray(),
      setAttributes: await db.setAttributes.toArray(),
      bodyParts: await db.bodyParts.toArray(),
      templates: await db.templates.toArray(),
      blockNotes: await db.blockNotes.toArray(),
    },
  }))
}

/** バックアップを復元する。既存データはすべて置き換えられる */
export async function importData(backup: unknown): Promise<void> {
  const parsed = validateBackup(backup)
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.exercises.bulkAdd(parsed.data.exercises)
    await db.tags.bulkAdd(parsed.data.tags)
    await db.days.bulkAdd(parsed.data.days)
    // 旧形式(単数 attribute)のバックアップを複数 attributes[] へ正規化してから取り込む
    const sets = parsed.data.sets.map((s) => {
      if (s.attribute && !s.attributes) {
        return { ...s, attributes: [s.attribute], attribute: undefined }
      }
      return s
    })
    await db.sets.bulkAdd(sets)
    await db.locations.bulkAdd(parsed.data.locations)
    await db.settings.bulkAdd(parsed.data.settings)
    await db.setAttributes.bulkAdd(parsed.data.setAttributes ?? [])
    await db.templates.bulkAdd(parsed.data.templates ?? [])
    await db.blockNotes.bulkAdd(parsed.data.blockNotes ?? [])
    // 旧形式(bodyParts なし)の復元: デフォルト + 種目が使っている部位名から再構築する
    let bodyParts = parsed.data.bodyParts
    if (!bodyParts?.length) {
      bodyParts = buildDefaultBodyParts()
      const known = new Set(bodyParts.map((p) => p.name))
      let order = bodyParts.length
      for (const e of parsed.data.exercises) {
        if (!known.has(e.bodyPart)) {
          known.add(e.bodyPart)
          bodyParts.push({ id: crypto.randomUUID(), name: e.bodyPart, sortOrder: order++ })
        }
      }
    }
    await db.bodyParts.bulkAdd(bodyParts)
  })
}

export function validateBackup(value: unknown): BackupFile {
  if (typeof value !== 'object' || value === null) {
    throw new Error('バックアップファイルの形式が不正です')
  }
  const v = value as Partial<BackupFile>
  if (v.app !== 'training-memo-app') {
    throw new Error('このアプリのバックアップファイルではありません')
  }
  if (typeof v.formatVersion !== 'number' || v.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `バックアップの形式バージョン (${String(v.formatVersion)}) に対応していません。アプリを更新してください`,
    )
  }
  const data = v.data
  if (
    !data ||
    !Array.isArray(data.exercises) ||
    !Array.isArray(data.tags) ||
    !Array.isArray(data.days) ||
    !Array.isArray(data.sets) ||
    !Array.isArray(data.locations) ||
    !Array.isArray(data.settings)
  ) {
    throw new Error('バックアップファイルのデータ部が欠けています')
  }
  return value as BackupFile
}

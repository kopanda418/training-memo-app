import { db } from './db'
import type { Day, Exercise, Location, SetAttribute, Setting, Tag, WorkoutSet } from './types'

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
    await db.sets.bulkAdd(parsed.data.sets)
    await db.locations.bulkAdd(parsed.data.locations)
    await db.settings.bulkAdd(parsed.data.settings)
    await db.setAttributes.bulkAdd(parsed.data.setAttributes ?? [])
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

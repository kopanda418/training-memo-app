import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_FORMAT_VERSION, exportData, importData, validateBackup } from './backup'
import { db } from './db'
import { addSet, setDayLocation } from './repository'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('エクスポート → 全削除 → インポートで復元できる(M1 完了条件)', () => {
  it('全テーブルが元どおりになる', async () => {
    const ex = (await db.exercises.toArray())[0]
    const [heavy] = await db.tags.toArray()
    await addSet({ date: '2026-07-03', exerciseId: ex.id, tagId: heavy.id, weight: 100, reps: 5 })
    await setDayLocation('2026-07-03', 'ゴールドジム')
    await db.settings.put({ key: 'theme', value: 'dark' })

    const backup = await exportData()
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION)

    // 全削除(再オープンでデフォルトマスタが入り、ID も変わる = 復元が上書きすることの確認になる)
    await db.delete()
    await db.open()

    await importData(backup)

    expect(await db.sets.count()).toBe(1)
    const set = (await db.sets.toArray())[0]
    expect(set.exerciseId).toBe(ex.id)
    expect(set.tagId).toBe(heavy.id)
    expect(await db.exercises.count()).toBe(backup.data.exercises.length)
    expect((await db.exercises.toArray()).map((e) => e.id)).toContain(ex.id)
    expect((await db.days.toArray())[0].locationId).toBeDefined()
    expect((await db.settings.get('theme'))?.value).toBe('dark')
  })

  it('JSON 経由(文字列化 → パース)でも復元できる', async () => {
    const backup = await exportData()
    const roundTripped: unknown = JSON.parse(JSON.stringify(backup))
    await importData(roundTripped)
    expect(await db.exercises.count()).toBe(backup.data.exercises.length)
  })
})

describe('validateBackup', () => {
  it('別アプリ・非対応バージョン・欠損データを拒否する', () => {
    expect(() => validateBackup(null)).toThrow()
    expect(() => validateBackup({ app: 'other-app' })).toThrow()
    expect(() =>
      validateBackup({ app: 'training-memo-app', formatVersion: BACKUP_FORMAT_VERSION + 1 }),
    ).toThrow(/対応していません/)
    expect(() =>
      validateBackup({ app: 'training-memo-app', formatVersion: 1, data: { exercises: [] } }),
    ).toThrow()
  })
})

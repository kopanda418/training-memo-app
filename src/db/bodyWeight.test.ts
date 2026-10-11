import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportData, importData } from './backup'
import { getBodyWeight, getPreviousBodyWeight, listBodyWeights, setBodyWeight } from './bodyWeight'
import { db } from './db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('体重の記録(ADR-017)', () => {
  it('1 日 1 件で上書きし、undefined で削除する', async () => {
    await setBodyWeight('2026-10-10', 70.5)
    await setBodyWeight('2026-10-10', 70.25)
    expect(await getBodyWeight('2026-10-10')).toBe(70.25)
    await setBodyWeight('2026-10-10', undefined)
    expect(await getBodyWeight('2026-10-10')).toBeUndefined()
  })

  it('前回の記録と日付順の一覧を返す', async () => {
    await setBodyWeight('2026-10-08', 71)
    await setBodyWeight('2026-10-01', 72)
    await setBodyWeight('2026-10-10', 70)
    expect((await getPreviousBodyWeight('2026-10-10'))?.weight).toBe(71)
    expect((await listBodyWeights()).map((e) => e.date)).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-10',
    ])
  })

  it('バックアップの書き出し/読み込みに含まれ、旧ファイル(項目なし)も読める', async () => {
    await setBodyWeight('2026-10-10', 70.25)
    const backup = await exportData()
    expect(backup.data.bodyWeights).toEqual([{ date: '2026-10-10', weight: 70.25 }])

    await setBodyWeight('2026-10-11', 69)
    await importData(backup)
    expect(await listBodyWeights()).toEqual([{ date: '2026-10-10', weight: 70.25 }])

    const { bodyWeights: _omit, ...oldData } = backup.data
    void _omit
    await importData({ ...backup, data: oldData })
    expect(await listBodyWeights()).toEqual([])
  })
})

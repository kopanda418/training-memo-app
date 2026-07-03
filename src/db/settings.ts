import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/** settings テーブルのキー一覧(追加したらここに足す) */
export type SettingKey =
  | 'bodyWeight' // number: 自重ボタンで入る体重(kg)
  | 'quickSetAttributes' // string[]: セット属性のクイックボタン(最大3)
  | 'quickExerciseTagIds' // string[]: 種目タグのクイックボタン(tag id、最大3)
  | 'theme' // 'light' | 'dark' | 'system'

export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** 設定値を購読する(変更は即 UI 反映) */
export function useSetting<T>(key: SettingKey): T | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get(key)
    return row?.value as T | undefined
  }, [key])
}

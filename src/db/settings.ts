import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/** settings テーブルのキー一覧(追加したらここに足す) */
export type SettingKey =
  | 'bodyWeight' // number: 自重セットの 1RM 換算に使う体重(kg)
  | 'quickSetAttributes' // string[]: セット属性のクイックボタン(最大3)
  | 'quickExerciseTagIds' // string[]: 種目タグのクイックボタン(tag id、最大3)
  | 'wakeLockEnabled' // boolean: タイマー中の画面ロック防止(デフォルト true)
  | 'timerSound' // SoundId: タイマー終了音(デフォルト 'rising')
  | 'nativeTimerEnabled' // boolean: iOS ショートカット経由で標準タイマーを起動(デフォルト false)
  | 'nativeTimerShortcutName' // string: 呼び出すショートカット名(デフォルト '筋トレタイマー')
  | 'defaultUnit' // 'kg' | 'lbs': 新規セットの重量単位(デフォルト kg)
  | 'theme' // 'light' | 'dark' | 'system'(デフォルト dark)
  | 'defaultLocationId' // string: 記録初回入力時に自動付与する既定の場所(ホームジム。'' で無効)

/** セット属性クイックボタンの初期値(設定で変更可能)。RPE は専用欄へ移ったため動作系を既定に */
export const DEFAULT_QUICK_SET_ATTRIBUTES = ['左', '右', 'フル']

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

/**
 * iOS「ショートカット」経由で標準の時計アプリのタイマーを起動する。
 * - Web Audio タイマー(timerStore)と違い、システム管理のため画面ロック中でも鳴る
 * - ユーザーが事前に作成した同名ショートカット(入力秒数でタイマー開始)を呼ぶ
 * - shortcuts:// URL スキームは Apple 公式サポート。ユーザー操作起点で遷移させる
 */

/** 設定未指定時に呼び出すショートカット名 */
export const DEFAULT_SHORTCUT_NAME = '筋トレタイマー'

/** PWA へ自動復帰させたいユーザー向けに、ショートカット末尾の「URLを開く」に入れる URL */
export const PWA_URL = 'https://kopanda418.github.io/training-memo-app/'

/** ショートカットを起動して標準タイマーを秒数指定で開始する */
export function runNativeTimer(sec: number, shortcutName: string): void {
  if (sec <= 0) return
  const name = shortcutName.trim() || DEFAULT_SHORTCUT_NAME
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=${sec}`
}

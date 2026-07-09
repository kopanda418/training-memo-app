import { useEffect, useState } from 'react'
import { useSetting } from '../../db/settings'
import { formatTimerSeconds } from '../../lib/timerFormat'
import { DEFAULT_SHORTCUT_NAME } from './nativeTimer'
import { beginInterval, getLastTimerSec } from './timerStore'

/** これ未満のキーボード高さは、アドレスバー伸縮などのノイズとみなして無視する */
const KEYBOARD_THRESHOLD = 100

/**
 * iOS の数字キーボードで下部タブバー(⏱)が隠れる問題への対策。
 * キーボード表示中はその直上に浮くボタンを出し、ワンタップで前回のタイマー値の
 * まま即開始する(時間選択の工程を挟まない)。従来どおり時間を選びたい場合は
 * キーボードを閉じてタブバーの ⏱ を使う。
 *
 * キーボード高さ = innerHeight - visualViewport.height。
 * offsetTop(入力欄を見せるための自動スクロール量)は差し引かないこと:
 * 差し引くとスクロール時に値が縮み、ボタンがキーボードの裏へ落ちて消える。
 */
export function KeyboardTimerButton() {
  const nativeEnabled = useSetting<boolean>('nativeTimerEnabled') ?? false
  const shortcutName = useSetting<string>('nativeTimerShortcutName') ?? DEFAULT_SHORTCUT_NAME
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboardHeight(Math.max(0, window.innerHeight - vv.height))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  if (keyboardHeight <= KEYBOARD_THRESHOLD) return null

  const lastSec = getLastTimerSec()

  return (
    <button
      type="button"
      // pointerdown で起動: 直後に入力欄が blur され値は確定コミットされる(preventDefault しない)
      onPointerDown={() => beginInterval(lastSec, { nativeEnabled, shortcutName })}
      style={{ bottom: keyboardHeight + 8 }}
      className="fixed right-3 z-40 flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg active:bg-emerald-700"
    >
      <span aria-hidden>⏱</span>
      休憩 {formatTimerSeconds(lastSec)}
    </button>
  )
}

import { useEffect, useState } from 'react'
import { useSetting } from '../../db/settings'
import { floatingBottom, isKeyboardOpen, type ViewportMetrics } from '../../lib/keyboardTimer'
import { formatTimerSeconds } from '../../lib/timerFormat'
import { DEFAULT_SHORTCUT_NAME } from './nativeTimer'
import { beginInterval, getLastTimerSec } from './timerStore'

const INITIAL_METRICS: ViewportMetrics = { innerHeight: 0, viewportHeight: 0, offsetTop: 0 }

/**
 * iOS の数字キーボードで下部タブバー(⏱)が隠れる問題への対策。
 * キーボード表示中はその直上に浮くボタンを出し、ワンタップで前回のタイマー値の
 * まま即開始する(時間選択の工程を挟まない)。従来どおり時間を選びたい場合は
 * キーボードを閉じてタブバーの ⏱ を使う。
 *
 * offsetTop(iOS が入力欄を見せるためにページをずらした量)の扱いが要注意:
 * - **表示するかの判定には混ぜない**。混ぜるとスクロール中に値が縮んで unmount し、
 *   ボタンが一瞬で消える(v1.0.10 の不具合)
 * - **位置計算では必ず差し引く**。差し引かないと画面下側の入力欄で上へ飛んで消える
 *   (v1.0.19 で修正)
 *
 * 計算の根拠は lib/keyboardTimer.ts のコメント参照。
 */
export function KeyboardTimerButton() {
  const nativeEnabled = useSetting<boolean>('nativeTimerEnabled') ?? false
  const shortcutName = useSetting<string>('nativeTimerShortcutName') ?? DEFAULT_SHORTCUT_NAME
  const [metrics, setMetrics] = useState<ViewportMetrics>(INITIAL_METRICS)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // offsetTop の変化は resize ではなく scroll で飛んでくるため両方購読する
    const update = () =>
      setMetrics({
        innerHeight: window.innerHeight,
        viewportHeight: vv.height,
        offsetTop: vv.offsetTop,
      })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  if (!isKeyboardOpen(metrics)) return null

  const lastSec = getLastTimerSec()

  return (
    <button
      type="button"
      // pointerdown で起動: 直後に入力欄が blur され値は確定コミットされる(preventDefault しない)
      onPointerDown={() => beginInterval(lastSec, { nativeEnabled, shortcutName })}
      style={{ bottom: floatingBottom(metrics) }}
      className="fixed right-3 z-40 flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg active:bg-emerald-700"
    >
      <span aria-hidden>⏱</span>
      休憩 {formatTimerSeconds(lastSec)}
    </button>
  )
}

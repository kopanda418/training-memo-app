import { useEffect, useState } from 'react'
import { useSetting } from '../../db/settings'
import { anchoredTop, isKeyboardOpen } from '../../lib/keyboardTimer'
import { formatTimerSeconds } from '../../lib/timerFormat'
import { DEFAULT_SHORTCUT_NAME } from './nativeTimer'
import { beginInterval, getLastTimerSec } from './timerStore'

/** iOS はキーボード表示と自動スクロールをアニメーションするので、変化後しばらく追従する(ms) */
const TRACK_MS = 500

/**
 * ボタンの top(記録画面ルートを基準にした絶対座標)。出さないときは null。
 * 画面座標ではなく main のコンテンツ座標で求める。理由は lib/keyboardTimer.ts のコメント参照。
 */
function measureTop(): number | null {
  const vv = window.visualViewport
  if (!vv) return null
  if (!isKeyboardOpen({ innerHeight: window.innerHeight, viewportHeight: vv.height })) return null

  const el = document.activeElement
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return null

  const main = document.querySelector('main')
  if (!main) return null

  // main の上端を原点にしたコンテンツ座標へ変換(同じ getBoundingClientRect 同士の引き算)
  const origin = main.getBoundingClientRect().top - main.scrollTop
  const rect = el.getBoundingClientRect()
  return Math.round(
    anchoredTop({
      inputTop: rect.top - origin,
      inputBottom: rect.bottom - origin,
      scrollTop: main.scrollTop,
    }),
  )
}

/**
 * iOS の数字キーボードで下部タブバー(⏱)が隠れる問題への対策。
 * キーボード表示中は **フォーカス中の入力欄のすぐ上** に浮くボタンを出し、
 * ワンタップで前回のタイマー値のまま即開始する(時間選択の工程を挟まない)。
 * 従来どおり時間を選びたい場合はキーボードを閉じてタブバーの ⏱ を使う。
 *
 * position は fixed ではなく **記録画面ルート内の absolute**。
 * こうするとスクロールしてもボタンが入力欄に追従するため、スクロールリスナーが要らない
 * (記録入力の応答速度ルール)。fixed + visualViewport で画面下端に貼る方式は
 * iOS 実機で破綻した(v1.0.20 で方式変更。経緯は lib/keyboardTimer.ts のコメント)。
 */
export function KeyboardTimerButton() {
  const nativeEnabled = useSetting<boolean>('nativeTimerEnabled') ?? false
  const shortcutName = useSetting<string>('nativeTimerShortcutName') ?? DEFAULT_SHORTCUT_NAME
  const [top, setTop] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = 0
    let until = 0
    const apply = () =>
      setTop((prev) => {
        const next = measureTop()
        return next === prev ? prev : next
      })
    const loop = () => {
      apply()
      raf = performance.now() < until ? requestAnimationFrame(loop) : 0
    }
    // フォーカス移動・キーボード開閉のたびに、落ち着くまで数フレーム追従してから止まる
    const track = () => {
      until = performance.now() + TRACK_MS
      if (!raf) raf = requestAnimationFrame(loop)
    }
    apply()
    document.addEventListener('focusin', track)
    document.addEventListener('focusout', track)
    vv.addEventListener('resize', track)
    vv.addEventListener('scroll', track)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('focusin', track)
      document.removeEventListener('focusout', track)
      vv.removeEventListener('resize', track)
      vv.removeEventListener('scroll', track)
    }
  }, [])

  if (top === null) return null

  const lastSec = getLastTimerSec()

  return (
    <button
      type="button"
      // pointerdown で起動: 直後に入力欄が blur され値は確定コミットされる(preventDefault しない)
      onPointerDown={() => beginInterval(lastSec, { nativeEnabled, shortcutName })}
      style={{ top }}
      // h-10 は lib/keyboardTimer.ts の BUTTON_HEIGHT と一致させること
      className="absolute right-3 z-40 flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg active:bg-emerald-700"
    >
      <span aria-hidden>⏱</span>
      休憩 {formatTimerSeconds(lastSec)}
    </button>
  )
}

import { useEffect, useState } from 'react'
import { useSetting } from '../../db/settings'
import { floatingBottom, isKeyboardOpen, type ViewportMetrics } from '../../lib/keyboardTimer'
import { formatTimerSeconds } from '../../lib/timerFormat'
import { DEFAULT_SHORTCUT_NAME } from './nativeTimer'
import { beginInterval, getLastTimerSec } from './timerStore'

/** iOS はキーボード表示と自動スクロールをアニメーションするので、変化後しばらく追従する(ms) */
const TRACK_MS = 500

/** タッチ端末(= ソフトキーボードが出る端末)か。PC で入力中に出さないための判定 */
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

interface State {
  /** テキスト入力欄にフォーカスがあるか */
  focused: boolean
  metrics: ViewportMetrics
}

function read(): State {
  const el = document.activeElement
  const vv = window.visualViewport
  return {
    focused: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement,
    metrics: {
      innerHeight: window.innerHeight,
      viewportHeight: vv?.height ?? window.innerHeight,
    },
  }
}

function same(a: State, b: State): boolean {
  return (
    a.focused === b.focused &&
    a.metrics.innerHeight === b.metrics.innerHeight &&
    a.metrics.viewportHeight === b.metrics.viewportHeight
  )
}

/**
 * iOS の数字キーボードで下部タブバー(⏱)が隠れる問題への対策。
 * キーボード表示中はその直上(右端)に浮くボタンを出し、ワンタップで前回のタイマー値の
 * まま即開始する(時間選択の工程を挟まない)。従来どおり時間を選びたい場合は
 * キーボードを閉じてタブバーの ⏱ を使う。
 *
 * 【設計上の注意(実機で 3 回外した箇所)】
 * - **表示条件はフォーカスの有無**。キーボード高さで判定すると、画面下側の入力欄で
 *   高さが 0 近くになる場面があり、ボタンごと消える(v1.0.21 で判明)
 * - **位置は `bottom = キーボード高さ + 8` だけ**。`visualViewport.offsetTop` を
 *   足し引きすると場面ごとに逆方向へずれる(v1.0.19 で悪化)
 * - スクロールしても動かないこと(キーボード右上に固定)が仕様(v1.0.20 で入力欄基準に
 *   したが、追従してしまうため差し戻し)
 */
export function KeyboardTimerButton() {
  const nativeEnabled = useSetting<boolean>('nativeTimerEnabled') ?? false
  const shortcutName = useSetting<string>('nativeTimerShortcutName') ?? DEFAULT_SHORTCUT_NAME
  const [state, setState] = useState<State>(() => ({
    focused: false,
    metrics: { innerHeight: 0, viewportHeight: 0 },
  }))

  useEffect(() => {
    let raf = 0
    let until = 0
    const apply = () =>
      setState((prev) => {
        const next = read()
        return same(prev, next) ? prev : next
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
    const vv = window.visualViewport
    apply()
    document.addEventListener('focusin', track)
    document.addEventListener('focusout', track)
    vv?.addEventListener('resize', track)
    vv?.addEventListener('scroll', track)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('focusin', track)
      document.removeEventListener('focusout', track)
      vv?.removeEventListener('resize', track)
      vv?.removeEventListener('scroll', track)
    }
  }, [])

  if (!state.focused) return null
  // PC(物理キーボード)では visualViewport が縮まないので、その時だけ高さで足切りする
  if (!IS_TOUCH && !isKeyboardOpen(state.metrics)) return null

  const lastSec = getLastTimerSec()

  return (
    <button
      type="button"
      // pointerdown で起動: 直後に入力欄が blur され値は確定コミットされる(preventDefault しない)
      onPointerDown={() => beginInterval(lastSec, { nativeEnabled, shortcutName })}
      style={{ bottom: floatingBottom(state.metrics) }}
      className="fixed right-3 z-40 flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg active:bg-emerald-700"
    >
      <span aria-hidden>⏱</span>
      休憩 {formatTimerSeconds(lastSec)}
    </button>
  )
}

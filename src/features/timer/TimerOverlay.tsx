import { useEffect, useReducer, useState, useSyncExternalStore } from 'react'
import { Modal } from '../../components/Modal'
import { formatTimerSeconds } from '../../lib/timerFormat'
import { DEFAULT_SHORTCUT_NAME, runNativeTimer } from './nativeTimer'
import { useSetting } from '../../db/settings'
import {
  closeTimerOverlay,
  extendTimer,
  getTimerState,
  remainingSeconds,
  startTimer,
  stopTimer,
  subscribeTimer,
} from './timerStore'

const PRESETS = [60, 90, 120, 180]

/** インターバルタイマーのボトムシート(App 直下に常駐、タブバーの ⏱ から開く) */
export function TimerOverlay() {
  const timer = useSyncExternalStore(subscribeTimer, getTimerState)
  const nativeEnabled = useSetting<boolean>('nativeTimerEnabled') ?? false
  const shortcutName = useSetting<string>('nativeTimerShortcutName') ?? DEFAULT_SHORTCUT_NAME
  const [customSec, setCustomSec] = useState('')
  // 残り時間表示の再描画用(動作中のみ 250ms ごと)
  const [, forceTick] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!timer.endsAt || !timer.overlayOpen) return
    const id = setInterval(forceTick, 250)
    return () => clearInterval(id)
  }, [timer.endsAt, timer.overlayOpen])

  if (!timer.overlayOpen) return null

  const remaining = remainingSeconds()
  const running = timer.endsAt !== null

  // ネイティブ連携 ON なら iOS 時計アプリで開始(ロック中も鳴る)、OFF なら従来の Web Audio タイマー
  const handleStart = (sec: number) => {
    if (sec <= 0) return
    if (nativeEnabled) {
      // 時計アプリへ遷移するので、復帰時に残らないようボトムシートは閉じておく
      runNativeTimer(sec, shortcutName)
      closeTimerOverlay()
    } else {
      void startTimer(sec)
    }
  }

  return (
    <Modal open onClose={closeTimerOverlay} title="⏱ インターバルタイマー">
      {running ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="tabular text-6xl font-bold">{formatTimerSeconds(remaining)}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
              style={{ width: `${timer.totalSec ? (remaining / timer.totalSec) * 100 : 0}%` }}
            />
          </div>
          <div className="flex w-full gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
              onClick={() => extendTimer(30)}
            >
              ＋30秒
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white active:bg-red-700"
              onClick={stopTimer}
            >
              停止
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            タイマー中は画面が消灯しません(設定で変更可)。終了時は音でお知らせします
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                className="rounded-xl bg-sky-600 py-4 text-base font-bold text-white active:bg-sky-700"
                onClick={() => handleStart(sec)}
              >
                {formatTimerSeconds(sec)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              className="tabular min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-right text-base font-bold dark:border-slate-600 dark:bg-slate-700"
              placeholder="任意の秒数"
              value={customSec}
              onChange={(e) => setCustomSec(e.target.value)}
            />
            <span className="text-sm text-slate-400">秒</span>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              disabled={!(Number(customSec) > 0)}
              onClick={() => handleStart(Number(customSec))}
            >
              開始
            </button>
          </div>
          {nativeEnabled && (
            <p className="text-[10px] text-slate-400">
              iPhone
              の時計アプリでタイマーを開始します(画面ロック中でも鳴ります)。設定でオフにできます
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

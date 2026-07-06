import { useEffect, useReducer, useSyncExternalStore } from 'react'
import { NavLink } from 'react-router'
import {
  getTimerState,
  openTimerOverlay,
  remainingSeconds,
  subscribeTimer,
} from '../features/timer/timerStore'
import { formatTimerSeconds } from '../lib/timerFormat'

const tabs = [
  { to: '/record', label: '記録', icon: '📝' },
  { to: '/history', label: '履歴', icon: '📅' },
  { to: '/analytics', label: 'グラフ', icon: '📈' },
  { to: '/settings', label: '設定', icon: '⚙️' },
]

/** タブバー内のタイマーボタン(どの画面からも起動でき、動作中は残り時間を表示) */
function TimerTab() {
  const timer = useSyncExternalStore(subscribeTimer, getTimerState)
  const [, forceTick] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!timer.endsAt) return
    const id = setInterval(forceTick, 500)
    return () => clearInterval(id)
  }, [timer.endsAt])

  const running = timer.endsAt !== null
  return (
    <button
      type="button"
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
        running ? 'font-bold text-emerald-500' : 'text-slate-500 dark:text-slate-400'
      }`}
      onClick={openTimerOverlay}
    >
      <span className="text-xl leading-none" aria-hidden>
        ⏱
      </span>
      {running ? (
        <span className="tabular">{formatTimerSeconds(remainingSeconds())}</span>
      ) : (
        'タイマー'
      )}
    </button>
  )
}

export function TabBar() {
  return (
    // 下端ぴったりだと低すぎるため 7px だけ浮かせる(実機フィードバックで調整済み)。
    // after 疑似要素はバーと同色を画面外方向へ延長する保険(下に別色の帯を見せない)
    <nav className="relative flex border-t border-slate-200 bg-white pb-[7px] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-white dark:border-slate-800 dark:bg-slate-900 dark:after:bg-slate-900">
      {tabs.slice(0, 2).map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}
      <TimerTab />
      {tabs.slice(2).map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}
    </nav>
  )
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
          isActive
            ? 'font-bold text-sky-600 dark:text-sky-400'
            : 'text-slate-500 dark:text-slate-400'
        }`
      }
    >
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      {label}
    </NavLink>
  )
}

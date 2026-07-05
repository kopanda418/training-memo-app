import { NavLink } from 'react-router'

const tabs = [
  { to: '/record', label: '記録', icon: '📝' },
  { to: '/history', label: '履歴', icon: '📅' },
  { to: '/analytics', label: 'グラフ', icon: '📈' },
  { to: '/settings', label: '設定', icon: '⚙️' },
]

export function TabBar() {
  return (
    // 下端ぴったりだと低すぎるため 7px だけ浮かせる(実機フィードバックで調整済み)。
    // after 疑似要素はバーと同色を画面外方向へ延長する保険(下に別色の帯を見せない)
    <nav className="relative flex border-t border-slate-200 bg-white pb-[7px] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-white dark:border-slate-800 dark:bg-slate-900 dark:after:bg-slate-900">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive
                ? 'font-bold text-sky-600 dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <span className="text-xl leading-none" aria-hidden>
            {tab.icon}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

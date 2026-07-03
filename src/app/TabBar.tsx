import { NavLink } from 'react-router'

const tabs = [
  { to: '/record', label: '記録', icon: '📝' },
  { to: '/history', label: '履歴', icon: '📅' },
  { to: '/analytics', label: 'グラフ', icon: '📈' },
  { to: '/settings', label: '設定', icon: '⚙️' },
]

export function TabBar() {
  return (
    <nav
      className="flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      // セーフエリア分をそのまま足すと余白が過大(実機フィードバック)。ホームバーと重ならない最小限に詰める
      style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) - 14px), 0px)' }}
    >
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

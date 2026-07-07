import { Suspense, lazy, useState } from 'react'
import { MaxView } from './MaxView'
import { WeeklyView } from './WeeklyView'

// Chart.js はグラフ表示時のみロードする(初期バンドルを軽く保つ)
const GraphView = lazy(() => import('./GraphView'))

type View = 'weekly' | 'graph' | 'max'

export function AnalyticsPage() {
  const [view, setView] = useState<View>('weekly')

  const segClass = (active: boolean) =>
    `flex-1 rounded-lg py-1.5 text-sm ${
      active
        ? 'bg-white font-bold text-slate-900 shadow dark:bg-slate-600 dark:text-white'
        : 'text-slate-500 dark:text-slate-400'
    }`

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white p-3 pb-2 dark:bg-slate-950">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            className={segClass(view === 'weekly')}
            onClick={() => setView('weekly')}
          >
            週間
          </button>
          <button
            type="button"
            className={segClass(view === 'graph')}
            onClick={() => setView('graph')}
          >
            グラフ
          </button>
          <button type="button" className={segClass(view === 'max')} onClick={() => setView('max')}>
            MAX
          </button>
        </div>
      </div>
      {view === 'weekly' && <WeeklyView />}
      {view === 'graph' && (
        <Suspense
          fallback={<p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>}
        >
          <GraphView />
        </Suspense>
      )}
      {view === 'max' && <MaxView />}
    </div>
  )
}

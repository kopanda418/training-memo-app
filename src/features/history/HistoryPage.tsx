import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarView } from './CalendarView'
import { ExerciseHistoryView } from './ExerciseHistoryView'

export function HistoryPage() {
  // 記録画面の「履歴 ›」から view=exercise&ex=..&tag=.. で遷移してくる
  const [params] = useSearchParams()
  const [view, setView] = useState<'calendar' | 'exercise'>(
    params.get('view') === 'exercise' ? 'exercise' : 'calendar',
  )

  const segClass = (active: boolean) =>
    `flex-1 rounded-lg py-1.5 text-sm ${
      active
        ? 'bg-white font-bold text-slate-900 shadow dark:bg-slate-600 dark:text-white'
        : 'text-slate-500 dark:text-slate-400'
    }`

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/95 p-3 pb-2 backdrop-blur dark:bg-slate-950/95">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            className={segClass(view === 'calendar')}
            onClick={() => setView('calendar')}
          >
            カレンダー
          </button>
          <button
            type="button"
            className={segClass(view === 'exercise')}
            onClick={() => setView('exercise')}
          >
            種目別
          </button>
        </div>
      </div>
      {view === 'calendar' ? <CalendarView /> : <ExerciseHistoryView />}
    </div>
  )
}

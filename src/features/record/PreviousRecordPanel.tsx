import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { listHistory } from '../../db/repository'
import type { WorkoutSet } from '../../db/types'
import { formatDateLabel } from '../../lib/date'
import { formatSetWeight } from '../../lib/setFormat'

interface PreviousRecordPanelProps {
  date: string
  exerciseId: string
  tagId: string
}

/** 種目×タグの前回記録(1 セット 1 行 + 属性)。「履歴 ›」で種目別履歴ページへ */
export function PreviousRecordPanel({ date, exerciseId, tagId }: PreviousRecordPanelProps) {
  const navigate = useNavigate()
  const history = useLiveQuery(() => listHistory(exerciseId, tagId), [exerciseId, tagId])

  // 表示中の日より前で直近の日のセット群(listHistory は日付降順・日内は表示順)
  const previous = useMemo(() => {
    let result: { date: string; sets: WorkoutSet[] } | null = null
    for (const s of history ?? []) {
      if (s.date >= date) continue
      if (!result) result = { date: s.date, sets: [s] }
      else if (result.date === s.date) result.sets.push(s)
      else break
    }
    return result
  }, [history, date])

  if (!previous) return null

  return (
    <div className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      <div className="flex items-center">
        <span className="font-bold">前回 {formatDateLabel(previous.date)}</span>
        <button
          type="button"
          className="ml-auto px-1 font-bold text-sky-600 active:text-sky-400 dark:text-sky-400"
          onClick={() =>
            navigate(`/history?view=exercise&ex=${exerciseId}&tag=${encodeURIComponent(tagId)}`)
          }
        >
          履歴 ›
        </button>
      </div>
      <ul className="mt-0.5">
        {previous.sets.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 py-px leading-relaxed">
            <span className="w-4 shrink-0 text-center text-[10px] text-slate-400">{i + 1}</span>
            <span className="tabular">
              {formatSetWeight(s)} × {s.reps}回
            </span>
            {s.isWarmup && (
              <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 dark:bg-orange-900/60 dark:text-orange-300">
                W
              </span>
            )}
            {s.attribute && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                {s.attribute}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

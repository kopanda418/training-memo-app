import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listHistory } from '../../db/repository'
import type { WorkoutSet } from '../../db/types'
import { formatDateLabel } from '../../lib/date'

interface PreviousRecordPanelProps {
  date: string
  exerciseId: string
  tagId: string
}

/** 種目×タグの前回記録の表示。‹ › でさらに過去のセッションへ遡れる */
export function PreviousRecordPanel({ date, exerciseId, tagId }: PreviousRecordPanelProps) {
  const history = useLiveQuery(() => listHistory(exerciseId, tagId), [exerciseId, tagId])
  const [index, setIndex] = useState(0)

  // 表示中の日より前の記録をセッション(日)単位にまとめる(listHistory は日付降順)
  const sessions = useMemo(() => {
    const result: { date: string; sets: WorkoutSet[] }[] = []
    for (const s of history ?? []) {
      if (s.date >= date) continue
      const last = result[result.length - 1]
      if (last && last.date === s.date) last.sets.push(s)
      else result.push({ date: s.date, sets: [s] })
    }
    return result
  }, [history, date])

  // 対象(日付・種目)が変わったら前回位置へ戻す(レンダー中の派生 state 調整パターン)
  const [lastKey, setLastKey] = useState(`${date}|${exerciseId}|${tagId}`)
  const key = `${date}|${exerciseId}|${tagId}`
  if (lastKey !== key) {
    setLastKey(key)
    setIndex(0)
  }

  if (sessions.length === 0) return null
  const shown = sessions[Math.min(index, sessions.length - 1)]

  const navBtnClass = 'px-2 leading-none text-slate-400 active:text-sky-500 disabled:opacity-25'

  return (
    <div className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      <div className="flex items-center">
        <span className="font-bold">
          {index === 0 ? '前回' : `${index + 1}回前`} {formatDateLabel(shown.date)}
        </span>
        {sessions.length > 1 && (
          <span className="ml-auto flex items-center">
            <button
              type="button"
              aria-label="さらに過去の記録へ"
              className={navBtnClass}
              disabled={index >= sessions.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              ‹
            </button>
            <span className="text-[10px]">
              {index + 1}/{sessions.length}
            </span>
            <button
              type="button"
              aria-label="新しい記録へ"
              className={navBtnClass}
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              ›
            </button>
          </span>
        )}
      </div>
      <p className="mt-0.5 leading-relaxed">
        {shown.sets.map((s) => `${s.weight}${s.unit}×${s.reps}`).join(' / ')}
      </p>
    </div>
  )
}

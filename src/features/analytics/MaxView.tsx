import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { useSetting } from '../../db/settings'
import { estimateOneRepMax } from '../../lib/oneRepMax'
import { effectiveLoad } from '../../lib/setFormat'

interface MaxRow {
  exerciseId: string
  tagId: string
  bestLoad: number
  bestReps: number
  bestRm: number
}

/** 種目×タグごとの MAX 記録一覧(ウォームアップ・実績空欄は除外) */
export function MaxView() {
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const bodyWeight = useSetting<number>('bodyWeight')
  const { exerciseName, tagName } = useMasters()

  const rows = useMemo(() => {
    const map = new Map<string, MaxRow>()
    for (const s of sets ?? []) {
      if (s.isWarmup || s.reps <= 0) continue
      const load = effectiveLoad(s, bodyWeight)
      if (load === undefined) continue
      const key = `${s.exerciseId}|${s.tagId}`
      let row = map.get(key)
      if (!row) {
        row = { exerciseId: s.exerciseId, tagId: s.tagId, bestLoad: 0, bestReps: 0, bestRm: 0 }
        map.set(key, row)
      }
      row.bestLoad = Math.max(row.bestLoad, load)
      row.bestReps = Math.max(row.bestReps, s.reps)
      row.bestRm = Math.max(row.bestRm, estimateOneRepMax(load, s.reps))
    }
    return [...map.values()].sort((a, b) => b.bestRm - a.bestRm)
  }, [sets, bodyWeight])

  return (
    <div className="flex flex-col gap-3 p-3">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">👑 MAX 記録(種目×タグ)</h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">まだ記録がありません</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            <li className="flex items-center gap-2 py-1 text-[10px] text-slate-400">
              <span className="min-w-0 flex-1">種目</span>
              <span className="w-16 shrink-0 text-right">重量</span>
              <span className="w-10 shrink-0 text-right">回数</span>
              <span className="w-16 shrink-0 text-right">推定1RM</span>
            </li>
            {rows.map((row) => (
              <li key={`${row.exerciseId}|${row.tagId}`} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {exerciseName(row.exerciseId)}
                  {tagName(row.tagId) && (
                    <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                      {tagName(row.tagId)}
                    </span>
                  )}
                </span>
                <span className="tabular w-16 shrink-0 text-right text-sm font-bold">
                  {Math.round(row.bestLoad * 10) / 10}kg
                </span>
                <span className="tabular w-10 shrink-0 text-right text-sm">{row.bestReps}回</span>
                <span className="tabular w-16 shrink-0 text-right text-sm font-bold text-sky-500">
                  {Math.round(row.bestRm * 10) / 10}kg
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[10px] text-slate-400">
          ウォームアップ・実績空欄は除外。自重セットは体重+加重で換算(体重未登録分は除外)
        </p>
      </section>
    </div>
  )
}

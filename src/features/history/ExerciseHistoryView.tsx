import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { useSetting } from '../../db/settings'
import { NO_TAG, type WorkoutSet } from '../../db/types'
import { formatDateLabel, todayString } from '../../lib/date'
import { estimateOneRepMax } from '../../lib/oneRepMax'
import { effectiveLoad, formatSetWeight } from '../../lib/setFormat'
import { ExercisePicker } from '../record/ExercisePicker'

/** タグフィルタ: 'all' はすべて、NO_TAG はタグなしのみ、それ以外はタグ ID */
type TagFilter = 'all' | string

export function ExerciseHistoryView() {
  const navigate = useNavigate()
  // 記録画面からのディープリンク(ex=種目ID, tag=タグID。tag='' はタグなしフィルタ)
  const [params] = useSearchParams()
  const [exerciseId, setExerciseId] = useState<string | null>(params.get('ex'))
  const [tagFilter, setTagFilter] = useState<TagFilter>(
    params.get('tag') !== null ? params.get('tag')! : 'all',
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const { exerciseName, tagName, tags } = useMasters()
  const bodyWeight = useSetting<number>('bodyWeight')

  const sets = useLiveQuery<WorkoutSet[]>(
    () =>
      exerciseId ? db.sets.where('exerciseId').equals(exerciseId).toArray() : Promise.resolve([]),
    [exerciseId],
  )

  // 実際に使われているタグだけフィルタ候補に出す
  const usedTagIds = useMemo(() => new Set((sets ?? []).map((s) => s.tagId)), [sets])

  const groups = useMemo(() => {
    const filtered = (sets ?? []).filter((s) => tagFilter === 'all' || s.tagId === tagFilter)
    const byDate = new Map<string, typeof filtered>()
    for (const s of filtered) {
      if (!byDate.has(s.date)) byDate.set(s.date, [])
      byDate.get(s.date)!.push(s)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateSets]) => ({
        date,
        sets: dateSets.sort((a, b) => a.orderInDay - b.orderInDay),
      }))
  }, [sets, tagFilter])

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs ${
      active
        ? 'bg-sky-600 font-bold text-white'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    }`

  return (
    <div className="flex flex-col gap-3 p-3">
      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700"
        onClick={() => setPickerOpen(true)}
      >
        {exerciseId ? exerciseName(exerciseId) : '種目を選択'}
      </button>

      {exerciseId && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            className={chipClass(tagFilter === 'all')}
            onClick={() => setTagFilter('all')}
          >
            すべて
          </button>
          {usedTagIds.has(NO_TAG) && (
            <button
              type="button"
              className={chipClass(tagFilter === NO_TAG)}
              onClick={() => setTagFilter(NO_TAG)}
            >
              タグなし
            </button>
          )}
          {tags
            ?.filter((t) => usedTagIds.has(t.id))
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={chipClass(tagFilter === tag.id)}
                onClick={() => setTagFilter(tag.id)}
              >
                {tag.name}
              </button>
            ))}
        </div>
      )}

      {exerciseId && sets !== undefined && groups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">この条件の記録はありません</p>
      )}

      {groups.map((group) => (
        <section
          key={group.date}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            className="mb-1 text-sm font-bold text-sky-600 dark:text-sky-400"
            onClick={() =>
              navigate(group.date === todayString() ? '/record' : `/record?date=${group.date}`)
            }
          >
            {formatDateLabel(group.date)} ›
          </button>
          <ul className="flex flex-col gap-0.5">
            {group.sets.map((s, i) => (
              <li key={s.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
                  <span className="font-bold">
                    {formatSetWeight(s)} × {s.reps}回
                  </span>
                  {s.rpe != null && <span className="text-xs text-slate-400">RPE{s.rpe}</span>}
                  {s.isWarmup && (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 dark:bg-orange-900/60 dark:text-orange-300">
                      W
                    </span>
                  )}
                  {s.attributes?.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    >
                      {a}
                    </span>
                  ))}
                  {tagFilter === 'all' && tagName(s.tagId) && (
                    <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                      {tagName(s.tagId)}
                    </span>
                  )}
                  {(() => {
                    const load = effectiveLoad(s, bodyWeight)
                    return load !== undefined && load > 0 && s.reps > 0 ? (
                      <span className="ml-auto text-[10px] text-slate-400">
                        1RM {Math.round(estimateOneRepMax(load, s.reps) * 10) / 10}kg
                      </span>
                    ) : null
                  })()}
                </div>
                {s.memo && <p className="pl-7 text-xs text-slate-400">{s.memo}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pickerOpen && (
        <ExercisePicker
          open
          withTagStep={false}
          onClose={() => setPickerOpen(false)}
          onDone={(id) => {
            setExerciseId(id)
            setTagFilter('all')
          }}
        />
      )}
    </div>
  )
}

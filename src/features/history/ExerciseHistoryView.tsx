import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { NO_TAG, type WorkoutSet } from '../../db/types'
import { formatDateLabel, todayString } from '../../lib/date'
import { ExercisePicker } from '../record/ExercisePicker'

/** タグフィルタ: 'all' はすべて、NO_TAG はタグなしのみ、それ以外はタグ ID */
type TagFilter = 'all' | string

export function ExerciseHistoryView() {
  const navigate = useNavigate()
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  const { exerciseName, tagName, tags } = useMasters()

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
          className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
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
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
                <span className="font-bold">
                  {s.weight}
                  {s.unit} × {s.reps}回
                </span>
                {s.isAssisted && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    補助
                  </span>
                )}
                {tagFilter === 'all' && tagName(s.tagId) && (
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                    {tagName(s.tagId)}
                  </span>
                )}
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

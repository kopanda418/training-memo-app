import { useState } from 'react'
import { addSet, copyPreviousSession, getLastSet } from '../../db/repository'
import type { WorkoutSet } from '../../db/types'
import { SetRow } from './SetRow'

interface ExerciseBlockProps {
  date: string
  exerciseId: string
  tagId: string
  exerciseName: string
  tagName?: string
  sets: WorkoutSet[]
  /** セットが 0 件のブロック(追加直後)を取り消す */
  onRemoveEmpty: () => void
}

export function ExerciseBlock({
  date,
  exerciseId,
  tagId,
  exerciseName,
  tagName,
  sets,
  onRemoveEmpty,
}: ExerciseBlockProps) {
  const [message, setMessage] = useState<string | null>(null)

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const handleAddSet = async () => {
    const last = sets.length ? sets[sets.length - 1] : await getLastSet(exerciseId, tagId)
    await addSet({
      date,
      exerciseId,
      tagId,
      weight: last?.weight ?? 20,
      reps: last?.reps ?? 10,
      unit: last?.unit ?? 'kg',
    })
  }

  const handleCopyPrevious = async () => {
    const copied = await copyPreviousSession(date, exerciseId, tagId)
    if (copied === 0) showMessage('前回の記録がありません')
  }

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <header className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-bold">{exerciseName}</h2>
        {tagName && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            {tagName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => void handleCopyPrevious()}
          >
            前回コピー
          </button>
          {sets.length === 0 && (
            <button
              type="button"
              aria-label="種目を取り消す"
              className="px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={onRemoveEmpty}
            >
              ✕
            </button>
          )}
        </div>
      </header>
      {message && <p className="py-1 text-xs text-amber-600 dark:text-amber-400">{message}</p>}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {sets.map((set, i) => (
          <SetRow key={set.id} set={set} index={i} />
        ))}
      </div>
      <button
        type="button"
        className="mt-1 w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 active:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:active:bg-slate-700"
        onClick={() => void handleAddSet()}
      >
        ＋ セット追加
      </button>
    </section>
  )
}

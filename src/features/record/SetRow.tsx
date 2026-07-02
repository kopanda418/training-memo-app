import { NumberField } from '../../components/NumberField'
import { deleteSet, updateSet } from '../../db/repository'
import type { WorkoutSet } from '../../db/types'

interface SetRowProps {
  set: WorkoutSet
  index: number
}

export function SetRow({ set, index }: SetRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-5 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
      <NumberField
        value={set.weight}
        step={2.5}
        suffix={set.unit}
        onCommit={(weight) => void updateSet(set.id, { weight })}
      />
      <NumberField
        value={set.reps}
        step={1}
        integer
        suffix="回"
        onCommit={(reps) => void updateSet(set.id, { reps })}
      />
      <button
        type="button"
        className={`shrink-0 rounded-full px-2 py-1 text-xs ${
          set.isAssisted
            ? 'bg-amber-100 font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300'
            : 'text-slate-400 dark:text-slate-500'
        }`}
        onClick={() => void updateSet(set.id, { isAssisted: !set.isAssisted })}
      >
        補助
      </button>
      <button
        type="button"
        aria-label="セットを削除"
        className="ml-auto shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
        onClick={() => void deleteSet(set.id)}
      >
        ✕
      </button>
    </div>
  )
}

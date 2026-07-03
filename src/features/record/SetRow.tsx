import { useState } from 'react'
import { CommitInput } from '../../components/CommitInput'
import { deleteSet, updateSet } from '../../db/repository'
import { useSetting } from '../../db/settings'
import type { WorkoutSet } from '../../db/types'
import { estimateOneRepMax } from '../../lib/oneRepMax'

interface SetRowProps {
  set: WorkoutSet
  index: number
  /** 同ブロック内のひとつ前のセット(↺ 個別コピーの元) */
  prevSet?: WorkoutSet
}

function parseNum(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

/** 前セットから 1 項目だけコピーする ↺ ボタン(アイコンのみ) */
function CopyBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="shrink-0 px-0.5 text-sm leading-none text-sky-500 active:text-sky-300 disabled:opacity-25 dark:text-sky-400"
      onClick={onClick}
    >
      ↺
    </button>
  )
}

const numBoxClass =
  'rounded-md border border-slate-200 bg-transparent px-1 py-1.5 text-center dark:border-slate-700'

export function SetRow({ set, index, prevSet }: SetRowProps) {
  const bodyWeight = useSetting<number>('bodyWeight')
  const [hint, setHint] = useState<string | null>(null)

  const oneRm = estimateOneRepMax(set.weight, set.reps)

  const showHint = (text: string) => {
    setHint(text)
    setTimeout(() => setHint(null), 2500)
  }

  const applyBodyWeight = () => {
    if (bodyWeight && bodyWeight > 0) {
      void updateSet(set.id, { weight: bodyWeight })
    } else {
      showHint('設定タブで体重を登録すると「自重」で入力できます')
    }
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1">
        <span className="w-4 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
        <CopyBtn
          label="前セットの重量をコピー"
          disabled={!prevSet}
          onClick={() => prevSet && void updateSet(set.id, { weight: prevSet.weight })}
        />
        <CommitInput
          inputMode="decimal"
          className={`w-14 text-right text-base font-bold ${numBoxClass}`}
          value={String(set.weight)}
          onCommit={(t) => {
            const n = parseNum(t)
            if (n !== undefined) void updateSet(set.id, { weight: n })
          }}
        />
        <span className="shrink-0 text-xs text-slate-400">{set.unit}</span>
        <button
          type="button"
          className="shrink-0 rounded-md border border-slate-300 px-1 py-1 text-[10px] leading-none text-slate-500 active:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:active:bg-slate-700"
          onClick={applyBodyWeight}
        >
          自重
        </button>
        <CopyBtn
          label="前セットのレップ数(目標・実績)をコピー"
          disabled={!prevSet}
          onClick={() =>
            prevSet &&
            void updateSet(set.id, { targetReps: prevSet.targetReps, reps: prevSet.reps })
          }
        />
        <CommitInput
          inputMode="numeric"
          className={`w-9 text-sm text-slate-500 dark:text-slate-400 ${numBoxClass}`}
          value={set.targetReps != null ? String(set.targetReps) : ''}
          placeholder="目標"
          onCommit={(t) => {
            const n = parseNum(t)
            void updateSet(set.id, { targetReps: n === undefined ? undefined : Math.round(n) })
          }}
        />
        <span className="shrink-0 text-xs text-slate-400">/</span>
        <CommitInput
          inputMode="numeric"
          className={`w-9 text-base font-bold ${numBoxClass}`}
          value={String(set.reps)}
          onCommit={(t) => {
            const n = parseNum(t)
            if (n !== undefined) void updateSet(set.id, { reps: Math.round(n) })
          }}
        />
        <span className="shrink-0 text-xs text-slate-400">回</span>
        <button
          type="button"
          aria-label="セットを削除"
          className="ml-auto shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
          onClick={() => void deleteSet(set.id)}
        >
          ✕
        </button>
      </div>
      {hint && <p className="pl-5 pt-0.5 text-[10px] text-amber-600 dark:text-amber-400">{hint}</p>}
      <div className="mt-0.5 flex items-center gap-1 pl-5">
        <CopyBtn
          label="前セットのコメントをコピー"
          disabled={!prevSet?.memo}
          onClick={() => prevSet?.memo && void updateSet(set.id, { memo: prevSet.memo })}
        />
        <CommitInput
          className="min-w-0 flex-1 border-b border-slate-100 bg-transparent px-1 py-0.5 text-xs dark:border-slate-700/60"
          value={set.memo ?? ''}
          placeholder="メモ"
          onCommit={(t) => void updateSet(set.id, { memo: t.trim() || undefined })}
        />
        {oneRm > 0 && (
          <span className="shrink-0 text-[10px] text-slate-400">
            1RM {Math.round(oneRm * 10) / 10}kg
          </span>
        )}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router'
import { useMasters } from '../../db/hooks'
import { listSetsByDate } from '../../db/repository'
import { addDays, formatDateLabel, todayString } from '../../lib/date'
import { groupSetsIntoBlocks, type SetBlock } from '../../lib/groupSets'
import { ExerciseBlock } from './ExerciseBlock'
import { ExercisePicker } from './ExercisePicker'
import { LocationRow } from './LocationRow'

interface BlockKey {
  exerciseId: string
  tagId: string
}

export function RecordPage() {
  const [params, setParams] = useSearchParams()
  const today = todayString()
  const date = params.get('date') ?? today
  const setDate = (d: string) => {
    setParams(d === today ? {} : { date: d }, { replace: true })
  }

  const sets = useLiveQuery(() => listSetsByDate(date), [date])
  const { exerciseName, tagName } = useMasters()

  // 種目選択直後・セット 0 件のブロック(セットが入るまでの仮の器)
  const [emptyBlocks, setEmptyBlocks] = useState<BlockKey[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // 日付が変わったら仮ブロックを破棄(レンダー中の派生 state 調整パターン)
  const [blocksDate, setBlocksDate] = useState(date)
  if (blocksDate !== date) {
    setBlocksDate(date)
    setEmptyBlocks([])
  }

  const { blocks, recordedCount } = useMemo(() => {
    const grouped = groupSetsIntoBlocks(sets ?? [])
    const recordedCount = grouped.length
    const seen = new Set(grouped.map((b) => `${b.exerciseId}|${b.tagId}`))
    for (const b of emptyBlocks) {
      if (!seen.has(`${b.exerciseId}|${b.tagId}`)) grouped.push({ ...b, sets: [] })
    }
    return { blocks: grouped as SetBlock[], recordedCount }
  }, [sets, emptyBlocks])

  const handlePicked = (exerciseId: string, tagId: string) => {
    setEmptyBlocks((prev) =>
      prev.some((b) => b.exerciseId === exerciseId && b.tagId === tagId)
        ? prev
        : [...prev, { exerciseId, tagId }],
    )
  }

  const removeEmptyBlock = (block: BlockKey) => {
    setEmptyBlocks((prev) =>
      prev.filter((b) => !(b.exerciseId === block.exerciseId && b.tagId === block.tagId)),
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex items-center justify-between px-1 py-1.5">
          <button
            type="button"
            aria-label="前の日"
            className="px-4 py-1 text-xl text-slate-500 active:text-sky-600"
            onClick={() => setDate(addDays(date, -1))}
          >
            ‹
          </button>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-base font-bold">{formatDateLabel(date)}</span>
            {date !== today && (
              <button
                type="button"
                className="text-xs text-sky-600 dark:text-sky-400"
                onClick={() => setDate(today)}
              >
                今日へ戻る
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="次の日"
            className="px-4 py-1 text-xl text-slate-500 active:text-sky-600"
            onClick={() => setDate(addDays(date, 1))}
          >
            ›
          </button>
        </div>
        <div className="flex px-3 pb-2">
          <LocationRow date={date} />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {blocks.length === 0 && sets !== undefined && (
          <p className="py-10 text-center text-sm text-slate-400">
            記録がありません。
            <br />
            下の「＋ 種目を追加」から始めましょう
          </p>
        )}
        {blocks.map((block, i) => (
          <ExerciseBlock
            key={`${block.exerciseId}|${block.tagId}`}
            date={date}
            exerciseId={block.exerciseId}
            tagId={block.tagId}
            exerciseName={exerciseName(block.exerciseId)}
            tagName={tagName(block.tagId)}
            sets={block.sets}
            onRemoveEmpty={() => removeEmptyBlock(block)}
            isFirst={i === 0}
            isLast={i >= recordedCount - 1}
          />
        ))}
        <button
          type="button"
          className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white active:bg-sky-700"
          onClick={() => setPickerOpen(true)}
        >
          ＋ 種目を追加
        </button>
      </div>

      {/* 閉じたらアンマウントして選択状態をリセットする */}
      {pickerOpen && (
        <ExercisePicker open onClose={() => setPickerOpen(false)} onDone={handlePicked} />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router'
import { useMasters } from '../../db/hooks'
import { listSetsByDate } from '../../db/repository'
import { addDays, formatDateLabel, todayString } from '../../lib/date'
import { groupSetsIntoBlocks, type SetBlock } from '../../lib/groupSets'
import { KeyboardTimerButton } from '../timer/KeyboardTimerButton'
import { ExerciseBlock } from './ExerciseBlock'
import { ExercisePicker } from './ExercisePicker'
import { LocationRow } from './LocationRow'
import { TemplateModal } from './TemplateModal'

interface BlockKey {
  exerciseId: string
  tagId: string
}

export function RecordPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
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
  const [templateOpen, setTemplateOpen] = useState(false)
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
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
            {/* 日付タップでその月の履歴カレンダーへ(#5) */}
            <button
              type="button"
              className="text-base font-bold active:text-sky-600"
              onClick={() => navigate(`/history?view=calendar&ym=${date.slice(0, 7)}`)}
            >
              {formatDateLabel(date)}
            </button>
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
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-[2] rounded-xl bg-sky-600 py-3 text-sm font-bold text-white active:bg-sky-700"
            onClick={() => setPickerOpen(true)}
          >
            ＋ 種目を追加
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-800"
            onClick={() => setTemplateOpen(true)}
          >
            メニュー
          </button>
        </div>
      </div>

      {/* 閉じたらアンマウントして選択状態をリセットする */}
      {pickerOpen && (
        <ExercisePicker open onClose={() => setPickerOpen(false)} onDone={handlePicked} />
      )}
      {templateOpen && <TemplateModal open date={date} onClose={() => setTemplateOpen(false)} />}

      {/* 数字キーボードで隠れるタブバーの ⏱ を補う: キーボード直上に前回値ワンタップ起動ボタン */}
      <KeyboardTimerButton />
    </div>
  )
}

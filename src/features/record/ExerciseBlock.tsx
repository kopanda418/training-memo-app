import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Modal } from '../../components/Modal'
import { TransferModal } from '../../components/TransferModal'
import {
  addSet,
  changeBlockTag,
  copyPreviousSession,
  getLastSet,
  moveBlockInDay,
  reorderSetsInBlock,
} from '../../db/repository'
import { NO_TAG, type WorkoutSet } from '../../db/types'
import { TagSelectModal } from '../settings/TagSelectModal'
import { PreviousRecordPanel } from './PreviousRecordPanel'
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
  /** 並べ替え可否(記録済みブロック内での位置) */
  isFirst: boolean
  isLast: boolean
}

export function ExerciseBlock({
  date,
  exerciseId,
  tagId,
  exerciseName,
  tagName,
  sets,
  onRemoveEmpty,
  isFirst,
  isLast,
}: ExerciseBlockProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // セット番号の長押し(250ms)でドラッグ開始(タップやスクロールと衝突させない)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = sets.map((s) => s.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void reorderSetsInBlock(date, exerciseId, tagId, arrayMove(ids, from, to))
  }

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
      isBodyweight: last?.isBodyweight,
      isWarmup: last?.isWarmup,
      reps: last?.reps ?? 10,
      rpe: last?.rpe,
      attributes: last?.attributes,
      unit: last?.unit,
    })
  }

  const handleCopyPrevious = async () => {
    const copied = await copyPreviousSession(date, exerciseId, tagId)
    if (copied === 0) showMessage('前回の記録がありません')
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-1 flex items-start gap-2">
        {/* 種目名は 2 行まで折り返して全文表示(途切れ対策) */}
        <h2 className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-tight">
          {exerciseName}
        </h2>
        {/* タグは後から変更できる(タップでタグ選択。日内のこのブロック全セットに適用) */}
        <button
          type="button"
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
            tagName
              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300'
              : 'border border-dashed border-slate-300 text-slate-400 dark:border-slate-600'
          }`}
          onClick={() => setTagModalOpen(true)}
        >
          {tagName ?? '＋タグ'}
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
          onClick={() => void handleCopyPrevious()}
        >
          前回コピー
        </button>
        {sets.length > 0 ? (
          <button
            type="button"
            aria-label="この種目のメニュー(並べ替え・別の日へ)"
            className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => setMenuOpen(true)}
          >
            ⋯
          </button>
        ) : (
          <button
            type="button"
            aria-label="種目を取り消す"
            className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
            onClick={onRemoveEmpty}
          >
            ✕
          </button>
        )}
      </header>
      {message && <p className="py-1 text-xs text-amber-600 dark:text-amber-400">{message}</p>}
      <PreviousRecordPanel date={date} exerciseId={exerciseId} tagId={tagId} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {sets.map((set, i) => (
              <SetRow key={set.id} set={set} index={i} prevSet={i > 0 ? sets[i - 1] : undefined} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="mt-1 w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 active:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:active:bg-slate-700"
        onClick={() => void handleAddSet()}
      >
        ＋ セット追加
      </button>
      {menuOpen && (
        <Modal open onClose={() => setMenuOpen(false)} title={exerciseName}>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm disabled:opacity-30 dark:border-slate-700"
              disabled={isFirst}
              onClick={() => {
                void moveBlockInDay(date, exerciseId, tagId, 'up')
                setMenuOpen(false)
              }}
            >
              ↑ 上へ移動
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm disabled:opacity-30 dark:border-slate-700"
              disabled={isLast}
              onClick={() => {
                void moveBlockInDay(date, exerciseId, tagId, 'down')
                setMenuOpen(false)
              }}
            >
              ↓ 下へ移動
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-slate-700"
              onClick={() => {
                setMenuOpen(false)
                setTransferOpen(true)
              }}
            >
              📆 別の日へコピー / 移動
            </button>
          </div>
        </Modal>
      )}
      {tagModalOpen && (
        <TagSelectModal
          open
          allowClear={tagId !== NO_TAG}
          clearLabel="タグなしにする"
          onClose={() => setTagModalOpen(false)}
          onSelect={(newTagId) => void changeBlockTag(date, exerciseId, tagId, newTagId ?? NO_TAG)}
        />
      )}
      {transferOpen && (
        <TransferModal
          open
          onClose={() => setTransferOpen(false)}
          title={`「${exerciseName}${tagName ? ` / ${tagName}` : ''}」を別の日へ`}
          fromDate={date}
          exerciseId={exerciseId}
          tagId={tagId}
        />
      )}
    </section>
  )
}

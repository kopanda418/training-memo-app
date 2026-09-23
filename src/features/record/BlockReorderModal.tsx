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
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { useMasters } from '../../db/hooks'
import { listSetsByDate, reorderBlocksInDay } from '../../db/repository'
import { groupSetsIntoBlocks } from '../../lib/groupSets'

interface BlockReorderModalProps {
  date: string
  onClose: () => void
}

function SortableBlockRow({ id, label, sub }: { id: string; label: string; sub: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {/* ハンドル部分だけ touch-none にして、一覧自体のスクロールは妨げない */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none shrink-0 cursor-grab px-3 py-3 text-lg text-slate-400 active:cursor-grabbing dark:text-slate-500"
        aria-label="並べ替え"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1 py-2 pr-2">
        <p className="truncate font-bold">{label}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
    </div>
  )
}

/** その日の種目ブロックを一覧で並べ替える(⠿ を長押し → ドラッグで好きな位置へ) */
export function BlockReorderModal({ date, onClose }: BlockReorderModalProps) {
  const sets = useLiveQuery(() => listSetsByDate(date), [date])
  const { exerciseName, tagName } = useMasters()
  const blocks = groupSetsIntoBlocks(sets ?? [])
  const liveKeys = blocks.map((b) => `${b.exerciseId}|${b.tagId}`)
  // DB 反映を待たずに並びを確定表示する(ドロップ直後に元の位置へ戻って見えるのを防ぐ)
  const [localKeys, setLocalKeys] = useState<string[] | null>(null)
  const keys =
    localKeys &&
    localKeys.length === liveKeys.length &&
    localKeys.every((k) => liveKeys.includes(k))
      ? localKeys
      : liveKeys
  const byKey = new Map(blocks.map((b) => [`${b.exerciseId}|${b.tagId}`, b]))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = keys.indexOf(String(active.id))
    const to = keys.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = arrayMove(keys, from, to)
    setLocalKeys(next)
    void reorderBlocksInDay(date, next)
  }

  return (
    <Modal open onClose={onClose} title="種目の並べ替え">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        ⠿ を長押しして、好きな位置へドラッグしてください(自動で保存されます)
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {keys.map((key) => {
              const b = byKey.get(key)
              if (!b) return null
              const tag = tagName(b.tagId)
              return (
                <SortableBlockRow
                  key={key}
                  id={key}
                  label={exerciseName(b.exerciseId)}
                  sub={`${tag ? `${tag} / ` : ''}${b.sets.length} セット`}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="mt-3 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700"
        onClick={onClose}
      >
        完了
      </button>
    </Modal>
  )
}

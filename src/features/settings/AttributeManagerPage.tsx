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
import { useNavigate } from 'react-router'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import {
  addLocation,
  addTag,
  deleteLocation,
  deleteSetAttribute,
  deleteTag,
  listLocations,
  listSetAttributes,
  reorderLocations,
  reorderSetAttributes,
  reorderTags,
  renameLocation,
  upsertSetAttribute,
  type DeleteResult,
} from '../../db/repository'

// ドラッグハンドル付きの 1 行コンポーネント
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none shrink-0 cursor-grab px-1 text-slate-300 active:cursor-grabbing dark:text-slate-600"
        aria-label="並び替え"
      >
        ⠿
      </button>
      {children}
    </div>
  )
}

/** 種目タグ・セット属性・場所の管理(記録で使用中は削除ブロック) */
export function AttributeManagerPage() {
  const navigate = useNavigate()
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])
  const attributes = useLiveQuery(() => listSetAttributes(), [])
  const locations = useLiveQuery(() => listLocations(), [])
  const [message, setMessage] = useState<string | null>(null)
  const [newAttr, setNewAttr] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newLocation, setNewLocation] = useState('')

  // PointerSensor の 250ms 長押しでドラッグ開始(スクロール・タップとの競合を防ぐ)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const showError = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3500)
  }

  const handleDelete = async (name: string, run: () => Promise<DeleteResult>) => {
    const result = await run()
    if (!result.deleted) {
      showError(`「${name}」は記録 ${result.usedCount} 件で使用中のため削除できません`)
    }
  }

  // --- ドラッグ終了ハンドラ ---
  const handleTagDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !tags) return
    const ids = tags.map((t) => t.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void reorderTags(arrayMove(ids, from, to))
  }

  const handleAttrDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !attributes) return
    const ids = attributes.map((a) => a.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void reorderSetAttributes(arrayMove(ids, from, to))
  }

  const handleLocDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !locations) return
    const ids = locations.map((l) => l.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void reorderLocations(arrayMove(ids, from, to))
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <header className="flex items-center gap-2">
        <button
          type="button"
          className="text-sm text-sky-600 dark:text-sky-400"
          onClick={() => navigate('/settings')}
        >
          ‹ 設定
        </button>
        <h1 className="text-base font-bold">タグ・属性・場所の管理</h1>
      </header>

      {message && <p className="text-xs text-red-500">{message}</p>}

      {/* 種目タグ */}
      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">種目タグ(高重量日 など)</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleTagDragEnd}
        >
          <SortableContext
            items={tags?.map((t) => t.id) ?? []}
            strategy={verticalListSortingStrategy}
          >
            {tags?.map((tag) => (
              <SortableRow key={tag.id} id={tag.id}>
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                <button
                  type="button"
                  aria-label={`${tag.name}を削除`}
                  className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
                  onClick={() => void handleDelete(tag.name, () => deleteTag(tag.id))}
                >
                  ✕
                </button>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
        {tags?.length === 0 && <p className="py-2 text-xs text-slate-400">タグはありません</p>}
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="新しいタグ(例: 高重量日、試合前)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={!newTag.trim()}
            onClick={() => {
              void addTag(newTag)
              setNewTag('')
            }}
          >
            追加
          </button>
        </div>
      </section>

      {/* セット属性 */}
      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">セット属性(フル、DS など)</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleAttrDragEnd}
        >
          <SortableContext
            items={attributes?.map((a) => a.id) ?? []}
            strategy={verticalListSortingStrategy}
          >
            {attributes?.map((attr) => (
              <SortableRow key={attr.id} id={attr.id}>
                <span className="min-w-0 flex-1 truncate">{attr.name}</span>
                <button
                  type="button"
                  aria-label={`${attr.name}を削除`}
                  className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
                  onClick={() => void handleDelete(attr.name, () => deleteSetAttribute(attr.id))}
                >
                  ✕
                </button>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
        {attributes?.length === 0 && (
          <p className="py-2 text-xs text-slate-400">セット属性はありません</p>
        )}
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="新しい属性(例: DS、テンポ)"
            value={newAttr}
            onChange={(e) => setNewAttr(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={!newAttr.trim()}
            onClick={() => {
              void upsertSetAttribute(newAttr)
              setNewAttr('')
            }}
          >
            追加
          </button>
        </div>
        <p className="text-xs text-slate-400">
          ここで追加した属性はセット行やクイックボタン設定の候補に出ます
        </p>
      </section>

      {/* トレーニング場所 */}
      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">トレーニング場所</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleLocDragEnd}
        >
          <SortableContext
            items={locations?.map((l) => l.id) ?? []}
            strategy={verticalListSortingStrategy}
          >
            {locations?.map((loc) => (
              <SortableRow key={loc.id} id={loc.id}>
                <CommitInput
                  className="min-w-0 flex-1 bg-transparent"
                  value={loc.name}
                  onCommit={(t) => void renameLocation(loc.id, t)}
                />
                <button
                  type="button"
                  aria-label={`${loc.name}を削除`}
                  className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
                  onClick={() => void handleDelete(loc.name, () => deleteLocation(loc.id))}
                >
                  ✕
                </button>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
        {locations?.length === 0 && <p className="py-2 text-xs text-slate-400">場所はありません</p>}
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="新しい場所(例: ジムA、自宅)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={!newLocation.trim()}
            onClick={() => {
              void addLocation(newLocation)
              setNewLocation('')
            }}
          >
            追加
          </button>
        </div>
        <p className="text-xs text-slate-400">名前はタップで編集できます</p>
      </section>
    </div>
  )
}

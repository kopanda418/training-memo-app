import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { addTag } from '../../db/repository'

interface TagSelectModalProps {
  open: boolean
  onClose: () => void
  /** undefined で解除 */
  onSelect: (tagId: string | undefined) => void
  allowClear?: boolean
  clearLabel?: string
}

/** 種目タグの選択モーダル(検索 + 新規作成)。設定のクイックボタン構成などに使う */
export function TagSelectModal({
  open,
  onClose,
  onSelect,
  allowClear,
  clearLabel = 'このボタンを未設定にする',
}: TagSelectModalProps) {
  const [query, setQuery] = useState('')
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])

  const trimmed = query.trim()
  const active = tags?.filter((t) => !t.isArchived) ?? []
  const filtered = active.filter((t) => !trimmed || t.name.includes(trimmed))
  const hasExact = active.some((t) => t.name === trimmed)

  const pick = (tagId: string | undefined) => {
    onSelect(tagId)
    onClose()
  }

  const handleCreate = async () => {
    const tag = await addTag(trimmed)
    pick(tag.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="タグを選択">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          placeholder="検索 / 新しいタグ名を入力"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
              onClick={() => pick(tag.id)}
            >
              {tag.name}
            </button>
          ))}
          {trimmed && !hasExact && (
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-sky-400 px-3 py-2.5 text-left text-sm text-sky-600 active:bg-sky-50 dark:text-sky-400"
              onClick={() => void handleCreate()}
            >
              「{trimmed}」を作成して選択
            </button>
          )}
        </div>
        {allowClear && (
          <button
            type="button"
            className="py-2 text-center text-sm text-red-500"
            onClick={() => pick(undefined)}
          >
            {clearLabel}
          </button>
        )}
      </div>
    </Modal>
  )
}

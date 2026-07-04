import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { listSetAttributes, upsertSetAttribute } from '../../db/repository'
import { DEFAULT_QUICK_SET_ATTRIBUTES, useSetting } from '../../db/settings'

interface AttributePickerProps {
  open: boolean
  onClose: () => void
  current?: string
  /** undefined で解除 */
  onSelect: (name: string | undefined) => void
}

/** セット属性の選択モーダル: クイックボタン + 属性バンク(インクリメンタルサーチ)+ 新規作成 */
export function AttributePicker({ open, onClose, current, onSelect }: AttributePickerProps) {
  const [query, setQuery] = useState('')
  const bank = useLiveQuery(() => listSetAttributes(), [])
  const quicks = (
    useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  ).filter((q) => q.trim() !== '')

  const trimmed = query.trim()
  const filtered = (bank ?? []).filter((a) => !trimmed || a.name.includes(trimmed))
  const hasExactMatch = (bank ?? []).some((a) => a.name === trimmed)

  const pick = (name: string | undefined) => {
    onSelect(name)
    onClose()
  }

  const itemClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700'

  return (
    <Modal open={open} onClose={onClose} title="セット属性">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {quicks.map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 active:bg-sky-200 dark:bg-sky-900 dark:text-sky-300"
              onClick={() => pick(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          placeholder="検索 / 新しい属性を入力"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((attr) => (
            <button
              key={attr.id}
              type="button"
              className={itemClass}
              onClick={() => pick(attr.name)}
            >
              {attr.name}
            </button>
          ))}
          {trimmed && !hasExactMatch && (
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-sky-400 px-3 py-2.5 text-left text-sm text-sky-600 active:bg-sky-50 dark:text-sky-400"
              onClick={() => {
                // どの経路(セット行・設定のクイックボタン)から作成してもバンクに残す
                void upsertSetAttribute(trimmed)
                pick(trimmed)
              }}
            >
              「{trimmed}」を作成して設定
            </button>
          )}
          {!trimmed && filtered.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">
              まだ属性がありません。上の入力欄から作成できます
            </p>
          )}
        </div>
        {current && (
          <button
            type="button"
            className="py-2 text-center text-sm text-red-500"
            onClick={() => pick(undefined)}
          >
            属性を解除
          </button>
        )}
      </div>
    </Modal>
  )
}

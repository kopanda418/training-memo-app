import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { listSetAttributes, upsertSetAttribute } from '../../db/repository'
import { DEFAULT_QUICK_SET_ATTRIBUTES, useSetting } from '../../db/settings'

interface AttributePickerProps {
  open: boolean
  onClose: () => void
  /** 現在このセットに付いている属性 */
  current: string[]
  /** 1 つトグルする(付与/解除)。開いたまま連続操作できる */
  onToggle: (name: string) => void
}

/** セット属性の複数選択モーダル: タップでトグル(閉じない)、検索・新規作成 */
export function AttributePicker({ open, onClose, current, onToggle }: AttributePickerProps) {
  const [query, setQuery] = useState('')
  const bank = useLiveQuery(() => listSetAttributes(), [])
  const quicks = (
    useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  ).filter((q) => q.trim() !== '')

  const trimmed = query.trim()
  const has = (name: string) => current.includes(name)

  // クイック + バンクを重複なくまとめ、検索で絞る
  const names = [...new Set([...quicks, ...(bank ?? []).map((a) => a.name)])]
  const filtered = names.filter((n) => !trimmed || n.includes(trimmed))
  const hasExactMatch = names.includes(trimmed)

  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-2 text-sm font-bold ${
      active
        ? 'bg-sky-600 text-white'
        : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
    }`

  return (
    <Modal open={open} onClose={onClose} title="セット属性(複数選択可)">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          placeholder="検索 / 新しい属性を入力"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex max-h-[45dvh] flex-wrap gap-1.5 overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className={chipClass(has(name))}
              onClick={() => onToggle(name)}
            >
              {has(name) ? '✓ ' : ''}
              {name}
            </button>
          ))}
          {trimmed && !hasExactMatch && (
            <button
              type="button"
              className="rounded-full border border-dashed border-sky-400 px-3 py-2 text-sm text-sky-600 active:bg-sky-50 dark:text-sky-400"
              onClick={() => {
                void upsertSetAttribute(trimmed)
                onToggle(trimmed)
                setQuery('')
              }}
            >
              ＋「{trimmed}」を作成
            </button>
          )}
          {filtered.length === 0 && !trimmed && (
            <p className="py-3 text-center text-xs text-slate-400">
              まだ属性がありません。上の入力欄から作成できます
            </p>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700"
          onClick={onClose}
        >
          完了
        </button>
      </div>
    </Modal>
  )
}

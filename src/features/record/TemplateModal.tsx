import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { useMasters } from '../../db/hooks'
import {
  applyTemplate,
  deleteTemplate,
  listSetsByDate,
  listTemplates,
  saveTemplateFromDay,
} from '../../db/repository'

interface TemplateModalProps {
  open: boolean
  onClose: () => void
  date: string
}

/** メニューのテンプレート: 選んでその日に一括展開 / この日のメニューを保存 / 削除 */
export function TemplateModal({ open, onClose, date }: TemplateModalProps) {
  const templates = useLiveQuery(() => listTemplates(), [])
  const daySets = useLiveQuery(() => listSetsByDate(date), [date])
  const { exerciseName, tagName } = useMasters()
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const handleApply = async (id: string) => {
    await applyTemplate(date, id)
    onClose()
  }

  const handleSave = async () => {
    try {
      await saveTemplateFromDay(date, newName)
      setNewName('')
      setMessage('保存しました')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存できませんでした')
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const itemsSummary = (items: { exerciseId: string; tagId: string }[]) =>
    items
      .map((item) => {
        const tag = tagName(item.tagId)
        return `${exerciseName(item.exerciseId)}${tag ? `(${tag})` : ''}`
      })
      .join(' / ')

  return (
    <Modal open={open} onClose={onClose} title="メニューのテンプレート">
      <div className="flex flex-col gap-2">
        {templates?.map((template) => (
          <div
            key={template.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => void handleApply(template.id)}
            >
              <span className="block text-sm font-bold">{template.name}</span>
              <span className="block truncate text-[10px] text-slate-400">
                {itemsSummary(template.items)}
              </span>
            </button>
            <button
              type="button"
              aria-label={`${template.name}を削除`}
              className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={() => void deleteTemplate(template.id)}
            >
              ✕
            </button>
          </div>
        ))}
        {templates?.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-400">
            テンプレートはまだありません。
            <br />
            記録した日のメニューを下から保存できます
          </p>
        )}
        <p className="text-xs text-slate-400">
          タップでこの日に展開します(各種目のセットは前回記録からコピー)
        </p>

        <div className="mt-1 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="mb-1.5 text-xs font-bold">この日のメニューをテンプレートとして保存</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
              placeholder="例: 背中の日"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              disabled={!newName.trim() || (daySets?.length ?? 0) === 0}
              onClick={() => void handleSave()}
            >
              保存
            </button>
          </div>
          {(daySets?.length ?? 0) === 0 && (
            <p className="mt-1 text-[10px] text-slate-400">この日にはまだ記録がありません</p>
          )}
          {message && <p className="mt-1 text-xs text-emerald-500">{message}</p>}
        </div>
      </div>
    </Modal>
  )
}

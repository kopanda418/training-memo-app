import { useState } from 'react'
import { useNavigate } from 'react-router'
import { transferSets } from '../db/repository'
import { todayString } from '../lib/date'
import { Modal } from './Modal'

interface TransferModalProps {
  open: boolean
  onClose: () => void
  title: string
  fromDate: string
  /** 指定すると種目×タグ単位、未指定なら日全体 */
  exerciseId?: string
  tagId?: string
}

/** 記録を別の日へコピー/移動するモーダル(対象日を選んで実行) */
export function TransferModal({
  open,
  onClose,
  title,
  fromDate,
  exerciseId,
  tagId,
}: TransferModalProps) {
  const navigate = useNavigate()
  const [target, setTarget] = useState(todayString())
  const [error, setError] = useState<string | null>(null)

  const run = async (mode: 'copy' | 'move') => {
    if (target === fromDate) {
      setError('コピー/移動元と同じ日です。別の日を選んでください')
      return
    }
    const n = await transferSets({ fromDate, toDate: target, mode, exerciseId, tagId })
    if (n === 0) {
      setError('対象の記録がありません')
      return
    }
    onClose()
    navigate(target === todayString() ? '/record' : `/record?date=${target}`)
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          コピー/移動先の日付
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setError(null)
            }}
          />
        </label>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700"
            onClick={() => void run('copy')}
          >
            コピーする
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white active:bg-amber-700"
            onClick={() => void run('move')}
          >
            移動する
          </button>
        </div>
        <p className="text-xs text-slate-400">
          コピー: 元の日に残したまま複製 / 移動:
          元の日から取り除いて移す(いずれも移動先の末尾に追加)
        </p>
      </div>
    </Modal>
  )
}

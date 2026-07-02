import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { getDay, listLocations, setDayLocation } from '../../db/repository'
import { db } from '../../db/db'

interface LocationRowProps {
  date: string
}

/** その日のトレーニング場所チップ。タップで過去候補からの選択 + 新規入力 */
export function LocationRow({ date }: LocationRowProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const day = useLiveQuery(() => getDay(date), [date])
  const locations = useLiveQuery(() => listLocations(), [])
  const current = useLiveQuery(
    () => (day?.locationId ? db.locations.get(day.locationId) : undefined),
    [day?.locationId],
  )
  const currentName = current?.name

  const choose = async (name: string) => {
    await setDayLocation(date, name)
    setText('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
          currentName
            ? 'bg-emerald-100 font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
        }`}
        onClick={() => setOpen(true)}
      >
        📍 {currentName ?? '場所を設定'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="トレーニング場所">
        <div className="flex flex-col gap-1.5">
          {locations?.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
              onClick={() => void choose(loc.name)}
            >
              {loc.name}
            </button>
          ))}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
              placeholder="新しい場所を入力"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              disabled={!text.trim()}
              onClick={() => void choose(text)}
            >
              設定
            </button>
          </div>
          {currentName && (
            <button
              type="button"
              className="mt-1 py-2 text-center text-sm text-red-500"
              onClick={() => void choose('')}
            >
              場所の設定を解除
            </button>
          )}
        </div>
      </Modal>
    </>
  )
}

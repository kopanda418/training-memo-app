import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { TransferModal } from '../../components/TransferModal'
import { useMasters } from '../../db/hooks'
import { listRecordedDates, listSetsByDate } from '../../db/repository'
import { addMonths, monthGrid } from '../../lib/calendar'
import { formatDateLabel, todayString } from '../../lib/date'
import { groupSetsIntoBlocks } from '../../lib/groupSets'
import { formatSetWeight } from '../../lib/setFormat'

const WEEKDAY_HEADER = ['日', '月', '火', '水', '木', '金', '土']

export function CalendarView() {
  const navigate = useNavigate()
  const today = todayString()
  const [y0, m0] = today.split('-').map(Number)
  const [[year, month], setYm] = useState<[number, number]>([y0, m0])
  const [selected, setSelected] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const weeks = useMemo(() => monthGrid(year, month), [year, month])
  const gridStart = weeks[0][0].date
  const gridEnd = weeks[weeks.length - 1][6].date
  const recorded = useLiveQuery(() => listRecordedDates(gridStart, gridEnd), [gridStart, gridEnd])
  const recordedSet = useMemo(() => new Set(recorded), [recorded])

  const selectedSets = useLiveQuery(
    () => (selected ? listSetsByDate(selected) : Promise.resolve([])),
    [selected],
  )
  const { exerciseName, tagName } = useMasters()
  const selectedBlocks = useMemo(() => groupSetsIntoBlocks(selectedSets ?? []), [selectedSets])

  const openDay = (date: string) => {
    navigate(date === today ? '/record' : `/record?date=${date}`)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="前の月"
          className="px-4 py-1 text-xl text-slate-500 active:text-sky-600"
          onClick={() => setYm(([y, m]) => addMonths(y, m, -1))}
        >
          ‹
        </button>
        <span className="text-base font-bold">
          {year}年{month}月
        </span>
        <button
          type="button"
          aria-label="次の月"
          className="px-4 py-1 text-xl text-slate-500 active:text-sky-600"
          onClick={() => setYm(([y, m]) => addMonths(y, m, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w} className="pb-1 text-xs text-slate-400">
            {w}
          </span>
        ))}
        {weeks.flat().map((cell) => {
          const isSelected = cell.date === selected
          const isToday = cell.date === today
          return (
            <button
              key={cell.date}
              type="button"
              className={`relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-sm ${
                !cell.inMonth ? 'text-slate-300 dark:text-slate-600' : ''
              } ${isSelected ? 'bg-sky-600 font-bold text-white' : isToday ? 'border border-sky-600 text-sky-600 dark:text-sky-400' : ''}`}
              onClick={() => setSelected(cell.date)}
            >
              {Number(cell.date.split('-')[2])}
              {recordedSet.has(cell.date) && (
                <span
                  className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-sky-500'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">{formatDateLabel(selected)}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white active:bg-sky-700"
                onClick={() => openDay(selected)}
              >
                開く
              </button>
              {selectedBlocks.length > 0 && (
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
                  onClick={() => setTransferOpen(true)}
                >
                  コピー/移動
                </button>
              )}
            </div>
          </header>
          {selectedBlocks.length === 0 ? (
            <p className="py-2 text-center text-xs text-slate-400">この日の記録はありません</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {selectedBlocks.map((block) => (
                <li key={`${block.exerciseId}|${block.tagId}`} className="text-xs">
                  <span className="font-bold">{exerciseName(block.exerciseId)}</span>
                  {tagName(block.tagId) && (
                    <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                      {tagName(block.tagId)}
                    </span>
                  )}
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    {block.sets.map((s) => `${formatSetWeight(s)}×${s.reps}`).join(' / ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && transferOpen && (
        <TransferModal
          open
          onClose={() => setTransferOpen(false)}
          title={`${formatDateLabel(selected)} の記録を別の日へ`}
          fromDate={selected}
        />
      )}
    </div>
  )
}

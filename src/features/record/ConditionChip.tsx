import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { getCondition, listPainsByDate } from '../../db/condition'
import { getMainScrollTop, saveRecordScroll } from './recordScroll'

interface ConditionChipProps {
  date: string
}

/** 体調・やる気・痛みの要約チップ。タップでその日の体調画面へ(ADR-014) */
export function ConditionChip({ date }: ConditionChipProps) {
  const navigate = useNavigate()
  const condition = useLiveQuery(() => getCondition(date), [date])
  const painCount = useLiveQuery(
    async () => (await listPainsByDate(date)).filter((p) => p.intensity > 0).length,
    [date],
  )

  const parts = [
    condition?.condition !== undefined && `体調${condition.condition}`,
    condition?.motivation !== undefined && `やる気${condition.motivation}`,
    painCount ? `痛み${painCount}` : false,
  ].filter(Boolean)

  return (
    <button
      type="button"
      className={`flex min-w-0 items-center gap-1 rounded-full px-3 py-1 text-xs ${
        parts.length
          ? 'bg-violet-100 font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
      }`}
      onClick={() => {
        saveRecordScroll(date, getMainScrollTop())
        navigate(`/condition?date=${date}`, { state: { from: 'record' } })
      }}
    >
      <span className="truncate">🩺 {parts.length ? parts.join('・') : '体調・痛み'}</span>
    </button>
  )
}

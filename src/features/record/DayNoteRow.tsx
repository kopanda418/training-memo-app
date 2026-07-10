import { useLiveQuery } from 'dexie-react-hooks'
import { CommitInput } from '../../components/CommitInput'
import { getDay, setDayNote } from '../../db/repository'

interface DayNoteRowProps {
  date: string
}

/** その日のトレーニング全体の感想メモ(体調・環境など)。空のときは 1 行、入力に応じて伸長する */
export function DayNoteRow({ date }: DayNoteRowProps) {
  const day = useLiveQuery(() => getDay(date), [date])

  return (
    <CommitInput
      multiline
      className="w-full resize-none rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs leading-snug text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:text-slate-200"
      value={day?.note ?? ''}
      placeholder="この日の全体メモ(体調・環境など)"
      onCommit={(t) => void setDayNote(date, t)}
    />
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { CommitInput } from '../../components/CommitInput'
import { getBlockNote, setBlockNote } from '../../db/repository'

interface BlockNoteRowProps {
  date: string
  exerciseId: string
  tagId: string
}

/** その日のこの種目(×タグ)全体の感想メモ。ラック状況・種目変更の理由・調子など */
export function BlockNoteRow({ date, exerciseId, tagId }: BlockNoteRowProps) {
  const blockNote = useLiveQuery(
    () => getBlockNote(date, exerciseId, tagId),
    [date, exerciseId, tagId],
  )

  return (
    <CommitInput
      multiline
      className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs leading-snug text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:text-slate-200"
      value={blockNote?.note ?? ''}
      placeholder="種目メモ(この日のこの種目の感想)"
      onCommit={(t) => void setBlockNote(date, exerciseId, tagId, t)}
    />
  )
}

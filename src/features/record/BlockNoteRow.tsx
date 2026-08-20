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
    <>
      {/* プラン欄(読み取り専用)。フォーム注意点・中止条件など取り込んだ指示(ADR-013) */}
      {blockNote?.planNote && (
        <div className="mt-1 flex items-start gap-1 rounded-lg border border-sky-200 bg-sky-50/60 px-2 py-1 dark:border-sky-800 dark:bg-sky-900/30">
          <span className="mt-px shrink-0 rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
            予定
          </span>
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-snug text-sky-800 dark:text-sky-200">
            {blockNote.planNote}
          </p>
        </div>
      )}
      <CommitInput
        multiline
        className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs leading-snug text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:text-slate-200"
        value={blockNote?.note ?? ''}
        placeholder="種目メモ(この日のこの種目の感想)"
        onCommit={(t) => void setBlockNote(date, exerciseId, tagId, t)}
      />
    </>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { addTag } from '../../db/repository'
import { BODY_PARTS, NO_TAG, type BodyPart, type Exercise } from '../../db/types'

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  onDone: (exerciseId: string, tagId: string) => void
  /** false にするとタグ選択の工程を省き、種目タップで即確定する(履歴画面の種目選択など) */
  withTagStep?: boolean
}

/** 部位タブ → 種目 → タグ選択(なし/既存/新規)の 2 段階モーダル */
export function ExercisePicker({ open, onClose, onDone, withTagStep = true }: ExercisePickerProps) {
  const [bodyPart, setBodyPart] = useState<BodyPart>('胸')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [newTagName, setNewTagName] = useState('')

  const exercises = useLiveQuery(() => db.exercises.orderBy('sortOrder').toArray(), [])
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])

  const finish = (exerciseId: string, tagId: string) => {
    onDone(exerciseId, tagId)
    onClose()
  }

  const handleCreateTag = async () => {
    if (!selected || !newTagName.trim()) return
    const tag = await addTag(newTagName)
    finish(selected.id, tag.id)
  }

  const listButtonClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700'

  return (
    <Modal open={open} onClose={onClose} title={selected ? 'タグを選択(任意)' : '種目を選択'}>
      {!selected ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {BODY_PARTS.map((part) => (
              <button
                key={part}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  part === bodyPart
                    ? 'bg-sky-600 font-bold text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
                onClick={() => setBodyPart(part)}
              >
                {part}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {exercises
              ?.filter((e) => e.bodyPart === bodyPart && !e.isArchived)
              .map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  className={listButtonClass}
                  onClick={() =>
                    withTagStep ? setSelected(exercise) : finish(exercise.id, NO_TAG)
                  }
                >
                  {exercise.name}
                </button>
              ))}
            {exercises?.filter((e) => e.bodyPart === bodyPart && !e.isArchived).length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">
                この部位の種目はまだありません(種目の追加は設定画面から)
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-sky-600 dark:text-sky-400"
              onClick={() => setSelected(null)}
            >
              ‹ 戻る
            </button>
            <span className="text-sm font-bold">{selected.name}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className={listButtonClass}
              onClick={() => finish(selected.id, NO_TAG)}
            >
              タグなし
            </button>
            {tags
              ?.filter((t) => !t.isArchived)
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={listButtonClass}
                  onClick={() => finish(selected.id, tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                placeholder="新しいタグ名"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                disabled={!newTagName.trim()}
                onClick={() => void handleCreateTag()}
              >
                作成して選択
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

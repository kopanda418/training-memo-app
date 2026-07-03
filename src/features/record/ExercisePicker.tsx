import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { addTag, listBodyParts } from '../../db/repository'
import { useSetting } from '../../db/settings'
import { NO_TAG, type Exercise } from '../../db/types'

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  onDone: (exerciseId: string, tagId: string) => void
  /** false にするとタグ選択の工程を省き、種目タップで即確定する(履歴画面の種目選択など) */
  withTagStep?: boolean
}

/** 部位タブ → 種目 → タグ選択(なし/既存/新規)の 2 段階モーダル */
export function ExercisePicker({ open, onClose, onDone, withTagStep = true }: ExercisePickerProps) {
  const [bodyPart, setBodyPart] = useState<string>('胸')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [tagQuery, setTagQuery] = useState('')

  const bodyParts = useLiveQuery(() => listBodyParts(), [])
  // 選択中の部位がマスタに存在しない場合は先頭へ寄せる(レンダー中の派生 state 調整パターン)
  if (bodyParts?.length && !bodyParts.some((p) => p.name === bodyPart)) {
    setBodyPart(bodyParts[0].name)
  }

  const exercises = useLiveQuery(() => db.exercises.orderBy('sortOrder').toArray(), [])
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])
  const quickTagIds = useSetting<string[]>('quickExerciseTagIds')

  const activeTags = tags?.filter((t) => !t.isArchived) ?? []
  // クイックボタン: 設定があればその 3 つ、なければ先頭 3 タグ
  const quickTags = quickTagIds
    ? quickTagIds.map((id) => activeTags.find((t) => t.id === id)).filter((t) => t !== undefined)
    : activeTags.slice(0, 3)

  const trimmedQuery = tagQuery.trim()
  const filteredTags = activeTags.filter((t) => !trimmedQuery || t.name.includes(trimmedQuery))
  const hasExactTag = activeTags.some((t) => t.name === trimmedQuery)

  const finish = (exerciseId: string, tagId: string) => {
    onDone(exerciseId, tagId)
    onClose()
  }

  const handleCreateTag = async (name: string) => {
    if (!selected || !name.trim()) return
    const tag = await addTag(name)
    finish(selected.id, tag.id)
  }

  const listButtonClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700'

  return (
    <Modal open={open} onClose={onClose} title={selected ? 'タグを選択(任意)' : '種目を選択'}>
      {!selected ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {bodyParts?.map((part) => (
              <button
                key={part.id}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  part.name === bodyPart
                    ? 'bg-sky-600 font-bold text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
                onClick={() => setBodyPart(part.name)}
              >
                {part.name}
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 active:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                onClick={() => finish(selected.id, NO_TAG)}
              >
                タグなし
              </button>
              {quickTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 active:bg-sky-200 dark:bg-sky-900 dark:text-sky-300"
                  onClick={() => finish(selected.id, tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
              placeholder="タグを検索 / 新しいタグ名を入力"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
            />
            <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={listButtonClass}
                  onClick={() => finish(selected.id, tag.id)}
                >
                  {tag.name}
                </button>
              ))}
              {trimmedQuery && !hasExactTag && (
                <button
                  type="button"
                  className="w-full rounded-lg border border-dashed border-sky-400 px-3 py-2.5 text-left text-sm text-sky-600 active:bg-sky-50 dark:text-sky-400"
                  onClick={() => void handleCreateTag(trimmedQuery)}
                >
                  「{trimmedQuery}」を作成して選択
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

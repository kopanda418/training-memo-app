import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import {
  addBodyPart,
  addExercise,
  deleteExercise,
  listBodyParts,
  renameExercise,
} from '../../db/repository'

/** 種目と部位の管理(追加・名前変更・削除。記録で使用中の種目は削除ブロック) */
export function ExerciseManagerPage() {
  const navigate = useNavigate()
  const bodyParts = useLiveQuery(() => listBodyParts(), [])
  const exercises = useLiveQuery(() => db.exercises.orderBy('sortOrder').toArray(), [])

  const [bodyPart, setBodyPart] = useState('胸')
  if (bodyParts?.length && !bodyParts.some((p) => p.name === bodyPart)) {
    setBodyPart(bodyParts[0].name)
  }

  const [newExercise, setNewExercise] = useState('')
  const [newPart, setNewPart] = useState('')
  const [partFormOpen, setPartFormOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 3500)
  }

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteExercise(id)
    if (!result.deleted) {
      showMessage(`「${name}」は記録 ${result.usedCount} 件で使用中のため削除できません`)
    }
  }

  const handleAddExercise = async () => {
    if (!newExercise.trim()) return
    await addExercise(newExercise, bodyPart)
    setNewExercise('')
  }

  const handleAddPart = async () => {
    if (!newPart.trim()) return
    const part = await addBodyPart(newPart)
    setNewPart('')
    setPartFormOpen(false)
    setBodyPart(part.name)
  }

  const filtered = exercises?.filter((e) => e.bodyPart === bodyPart) ?? []

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex items-center gap-2">
        <button
          type="button"
          className="text-sm text-sky-600 dark:text-sky-400"
          onClick={() => navigate('/settings')}
        >
          ‹ 設定
        </button>
        <h1 className="text-base font-bold">種目・部位の管理</h1>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
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
        <button
          type="button"
          className="shrink-0 rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400"
          onClick={() => setPartFormOpen((v) => !v)}
        >
          ＋部位
        </button>
      </div>

      {partFormOpen && (
        <div className="flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="新しい部位名(例: 前腕)"
            value={newPart}
            onChange={(e) => setNewPart(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={!newPart.trim()}
            onClick={() => void handleAddPart()}
          >
            部位を追加
          </button>
        </div>
      )}

      {message && <p className="text-xs text-red-500">{message}</p>}

      <div className="flex flex-col gap-1.5">
        {filtered.map((exercise) => (
          <div
            key={exercise.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-700"
          >
            <CommitInput
              className="min-w-0 flex-1 bg-transparent py-1 text-sm"
              value={exercise.name}
              onCommit={(t) => void renameExercise(exercise.id, t)}
            />
            <button
              type="button"
              aria-label={`${exercise.name}を削除`}
              className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={() => void handleDelete(exercise.id, exercise.name)}
            >
              ✕
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">この部位の種目はまだありません</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder={`${bodyPart}に種目を追加`}
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
          disabled={!newExercise.trim()}
          onClick={() => void handleAddExercise()}
        >
          追加
        </button>
      </div>
      <p className="text-xs text-slate-400">
        名前はタップで編集できます。記録で使用中の種目は削除できません
      </p>
    </div>
  )
}

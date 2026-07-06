import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import {
  deleteLocation,
  deleteSetAttribute,
  deleteTag,
  listLocations,
  listSetAttributes,
  renameLocation,
  upsertSetAttribute,
  type DeleteResult,
} from '../../db/repository'

/** 種目タグ・セット属性・場所の管理(記録で使用中は削除ブロック) */
export function AttributeManagerPage() {
  const navigate = useNavigate()
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])
  const attributes = useLiveQuery(() => listSetAttributes(), [])
  const locations = useLiveQuery(() => listLocations(), [])
  const [message, setMessage] = useState<string | null>(null)
  const [newAttr, setNewAttr] = useState('')

  const handleDelete = async (name: string, run: () => Promise<DeleteResult>) => {
    const result = await run()
    if (!result.deleted) {
      setMessage(`「${name}」は記録 ${result.usedCount} 件で使用中のため削除できません`)
      setTimeout(() => setMessage(null), 3500)
    }
  }

  const rowClass =
    'flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700'

  return (
    <div className="flex flex-col gap-4 p-3">
      <header className="flex items-center gap-2">
        <button
          type="button"
          className="text-sm text-sky-600 dark:text-sky-400"
          onClick={() => navigate('/settings')}
        >
          ‹ 設定
        </button>
        <h1 className="text-base font-bold">タグ・属性・場所の管理</h1>
      </header>

      {message && <p className="text-xs text-red-500">{message}</p>}

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">種目タグ(高重量日 など)</h2>
        {tags?.map((tag) => (
          <div key={tag.id} className={rowClass}>
            <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            <button
              type="button"
              aria-label={`${tag.name}を削除`}
              className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={() => void handleDelete(tag.name, () => deleteTag(tag.id))}
            >
              ✕
            </button>
          </div>
        ))}
        {tags?.length === 0 && <p className="py-2 text-xs text-slate-400">タグはありません</p>}
        <p className="text-xs text-slate-400">追加は記録画面の種目選択時にできます</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">セット属性(RPE9 など)</h2>
        {attributes?.map((attr) => (
          <div key={attr.id} className={rowClass}>
            <span className="min-w-0 flex-1 truncate">{attr.name}</span>
            <button
              type="button"
              aria-label={`${attr.name}を削除`}
              className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={() => void handleDelete(attr.name, () => deleteSetAttribute(attr.id))}
            >
              ✕
            </button>
          </div>
        ))}
        {attributes?.length === 0 && (
          <p className="py-2 text-xs text-slate-400">セット属性はありません</p>
        )}
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="新しい属性(例: DS、テンポ)"
            value={newAttr}
            onChange={(e) => setNewAttr(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={!newAttr.trim()}
            onClick={() => {
              void upsertSetAttribute(newAttr)
              setNewAttr('')
            }}
          >
            追加
          </button>
        </div>
        <p className="text-xs text-slate-400">
          ここで追加した属性はセット行やクイックボタン設定の候補に出ます
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold">トレーニング場所</h2>
        {locations?.map((loc) => (
          <div key={loc.id} className={rowClass}>
            <CommitInput
              className="min-w-0 flex-1 bg-transparent"
              value={loc.name}
              onCommit={(t) => void renameLocation(loc.id, t)}
            />
            <button
              type="button"
              aria-label={`${loc.name}を削除`}
              className="shrink-0 px-1 text-slate-300 active:text-red-500 dark:text-slate-600"
              onClick={() => void handleDelete(loc.name, () => deleteLocation(loc.id))}
            >
              ✕
            </button>
          </div>
        ))}
        {locations?.length === 0 && <p className="py-2 text-xs text-slate-400">場所はありません</p>}
        <p className="text-xs text-slate-400">
          名前はタップで編集できます。追加は記録画面の場所チップからできます
        </p>
      </section>
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import { addTag } from '../../db/repository'
import { DEFAULT_QUICK_SET_ATTRIBUTES, setSetting, useSetting } from '../../db/settings'

const inputClass =
  'w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700'

export function SettingsPage() {
  const bodyWeight = useSetting<number>('bodyWeight')
  const quickAttrs = useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  const quickTagIds = useSetting<string[]>('quickExerciseTagIds')
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])

  const activeTags = tags?.filter((t) => !t.isArchived) ?? []
  const quickTagNames = quickTagIds
    ? quickTagIds.map((id) => activeTags.find((t) => t.id === id)?.name ?? '')
    : activeTags.slice(0, 3).map((t) => t.name)

  const commitQuickAttr = (index: number, value: string) => {
    const next = [...quickAttrs]
    next[index] = value.trim()
    void setSetting('quickSetAttributes', next)
  }

  const commitQuickTag = async (index: number, value: string) => {
    const current = quickTagIds ?? activeTags.slice(0, 3).map((t) => t.id)
    const next = [...current]
    const name = value.trim()
    if (!name) {
      next[index] = ''
    } else {
      const tag = await addTag(name)
      next[index] = tag.id
    }
    await setSetting('quickExerciseTagIds', next)
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-lg font-bold">設定</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">体重(自重入力用)</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          記録画面の「自重」ボタンでこの値が重量欄に入ります(懸垂・ディップスなど)
        </p>
        <div className="mt-2 flex items-center gap-2">
          <CommitInput
            inputMode="decimal"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right text-base font-bold dark:border-slate-600 dark:bg-slate-700"
            value={bodyWeight != null ? String(bodyWeight) : ''}
            placeholder="例: 65"
            onCommit={(t) => {
              const n = Number(t)
              if (t.trim() !== '' && Number.isFinite(n) && n > 0) {
                void setSetting('bodyWeight', Math.round(n * 10) / 10)
              }
            }}
          />
          <span className="text-sm text-slate-500">kg</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">セット属性のクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          セット行に表示される 3 つの即時入力ボタン(空にするとそのボタンは非表示)
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <CommitInput
              key={i}
              className={inputClass}
              value={quickAttrs[i] ?? ''}
              placeholder={`ボタン${i + 1}`}
              onCommit={(t) => commitQuickAttr(i, t)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">種目タグのクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          種目選択時のタグ工程に表示される 3 つのボタン(タグ名で指定。存在しなければ新規作成)
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <CommitInput
              key={i}
              className={inputClass}
              value={quickTagNames[i] ?? ''}
              placeholder={`ボタン${i + 1}`}
              onCommit={(t) => void commitQuickTag(i, t)}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        テーマ・単位・種目/タグ管理・バックアップの設定は今後のマイルストーンで追加予定
      </p>
    </div>
  )
}

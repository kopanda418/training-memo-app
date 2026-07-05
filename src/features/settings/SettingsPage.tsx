import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import { DEFAULT_QUICK_SET_ATTRIBUTES, setSetting, useSetting } from '../../db/settings'
import { AttributePicker } from '../record/AttributePicker'
import { TagSelectModal } from './TagSelectModal'
import { ViewportDiagnostics } from './ViewportDiagnostics'

const slotBtnClass =
  'flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700'

export function SettingsPage() {
  const navigate = useNavigate()
  const bodyWeight = useSetting<number>('bodyWeight')
  const quickAttrs = useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  const quickTagIds = useSetting<string[]>('quickExerciseTagIds')
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])

  const [attrSlotOpen, setAttrSlotOpen] = useState<number | null>(null)
  const [tagSlotOpen, setTagSlotOpen] = useState<number | null>(null)

  const activeTags = tags?.filter((t) => !t.isArchived) ?? []
  const effectiveTagIds = quickTagIds ?? activeTags.slice(0, 3).map((t) => t.id)
  const tagNameOf = (id: string) => activeTags.find((t) => t.id === id)?.name

  const setQuickAttr = (index: number, value: string) => {
    const next = [...quickAttrs]
    next[index] = value
    void setSetting('quickSetAttributes', next)
  }

  const setQuickTag = (index: number, tagId: string) => {
    const next = [...effectiveTagIds]
    next[index] = tagId
    void setSetting('quickExerciseTagIds', next)
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-lg font-bold">設定</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">体重(自重セットの 1RM 換算用)</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          自重セットの 1RM は「体重 + 加重」で換算します。未登録の場合、自重セットの 1RM
          は表示されません
        </p>
        <div className="mt-2 flex items-center gap-2">
          <CommitInput
            inputMode="decimal"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right text-base font-bold dark:border-slate-600 dark:bg-slate-800"
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
        <h2 className="text-sm font-bold">マスタ管理</h2>
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
            onClick={() => navigate('/settings/exercises')}
          >
            種目・部位の管理 ›
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
            onClick={() => navigate('/settings/attributes')}
          >
            タグ・セット属性の管理 ›
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">セット属性のクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          セット行に表示される 3 つの即時入力ボタン。タップして作成済みの属性から選択(新規作成も可)
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={slotBtnClass}
              onClick={() => setAttrSlotOpen(i)}
            >
              {quickAttrs[i]?.trim() ? (
                quickAttrs[i]
              ) : (
                <span className="text-slate-400">未設定</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">種目タグのクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          種目選択時のタグ工程に表示される 3 つのボタン。タップして作成済みのタグから選択
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={slotBtnClass}
              onClick={() => setTagSlotOpen(i)}
            >
              {tagNameOf(effectiveTagIds[i] ?? '') ?? (
                <span className="text-slate-400">未設定</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <ViewportDiagnostics />

      <p className="text-xs text-slate-400">
        テーマ・単位・バックアップの設定は今後のマイルストーンで追加予定
      </p>

      {attrSlotOpen !== null && (
        <AttributePicker
          open
          current={quickAttrs[attrSlotOpen]?.trim() || undefined}
          onClose={() => setAttrSlotOpen(null)}
          onSelect={(name) => setQuickAttr(attrSlotOpen, name ?? '')}
        />
      )}
      {tagSlotOpen !== null && (
        <TagSelectModal
          open
          allowClear
          onClose={() => setTagSlotOpen(null)}
          onSelect={(tagId) => setQuickTag(tagSlotOpen, tagId ?? '')}
        />
      )}
    </div>
  )
}

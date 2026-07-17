import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CommitInput } from '../../components/CommitInput'
import { SwipeToDelete } from '../../components/SwipeToDelete'
import { showToast } from '../../components/Toast'
import { deleteSet, detectMaxUpdate, toggleSetAttribute, updateSet } from '../../db/repository'
import { DEFAULT_QUICK_SET_ATTRIBUTES, useSetting } from '../../db/settings'
import type { WorkoutSet } from '../../db/types'
import { estimateOneRepMax } from '../../lib/oneRepMax'
import { effectiveLoad } from '../../lib/setFormat'
import { AttributePicker } from './AttributePicker'

interface SetRowProps {
  set: WorkoutSet
  index: number
  /** 同ブロック内のひとつ前のセット(↺ 個別コピーの元) */
  prevSet?: WorkoutSet
}

function parseNum(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

/** 前セットから 1 項目だけコピーする ↺ ボタン(アイコンのみ) */
function CopyBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="shrink-0 px-0.5 text-sm leading-none text-sky-500 active:text-sky-300 disabled:opacity-25 dark:text-sky-400"
      onClick={onClick}
    >
      ↺
    </button>
  )
}

/** 項目を 1 つだけ消す ✕ ボタン(値が入っている時だけ表示する呼び出し想定) */
function ClearBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="shrink-0 px-0.5 text-xs leading-none text-slate-300 active:text-red-500 dark:text-slate-600"
      onClick={onClick}
    >
      ✕
    </button>
  )
}

const numBoxClass =
  'rounded-md border border-slate-200 bg-transparent px-1 py-1.5 text-center dark:border-slate-700'

export function SetRow({ set, index, prevSet }: SetRowProps) {
  const bodyWeight = useSetting<number>('bodyWeight')
  const quickAttrs = (
    useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  ).filter((q) => q.trim() !== '')
  const [attrPickerOpen, setAttrPickerOpen] = useState(false)

  // セット番号を長押し → ドラッグで並び替え(挿し込み)。番号部分だけが持ち手
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: set.id,
  })

  const attrs = set.attributes ?? []
  // 自重セットは「体重 + 加重」で 1RM 換算(体重未登録なら換算しない)
  const load = effectiveLoad(set, bodyWeight)
  const oneRm = load !== undefined ? estimateOneRepMax(load, set.reps) : 0

  /** 重量・実績の確定後に MAX 更新を判定して祝福トーストを出す */
  const commitAndCheckMax = async (changes: Parameters<typeof updateSet>[1]) => {
    await updateSet(set.id, changes)
    const message = await detectMaxUpdate(set.id)
    if (message) showToast(message)
  }

  const toggleBodyweight = () => {
    if (set.isBodyweight) {
      // OFF: 加重分の数値はそのまま通常重量として残す
      void updateSet(set.id, { isBodyweight: undefined })
    } else {
      // ON: 重量欄は「加重分」の意味になるので 0(純自重)から始める
      void updateSet(set.id, { isBodyweight: true, weight: 0 })
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'relative z-10 opacity-90' : ''}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <SwipeToDelete
        onDelete={() => void deleteSet(set.id)}
        deleteLabel="削除"
        wrapperClassName={isDragging ? 'rounded-lg' : ''}
        contentClassName={
          isDragging ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'
        }
      >
        <div className={`py-1.5 ${set.isWarmup && !isDragging ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-1">
            <span
              {...attributes}
              {...listeners}
              data-drag-handle="true"
              role="button"
              aria-label="長押しして並び替え"
              className="w-4 shrink-0 cursor-grab text-center text-xs text-slate-400"
              style={{ touchAction: 'none' }}
            >
              {index + 1}
            </span>
            <CopyBtn
              label="前セットの重量をコピー"
              disabled={!prevSet}
              onClick={() =>
                prevSet &&
                void updateSet(set.id, {
                  weight: prevSet.weight,
                  isBodyweight: prevSet.isBodyweight,
                })
              }
            />
            {set.isBodyweight && (
              <span className="shrink-0 text-[10px] font-bold text-emerald-500">自重+</span>
            )}
            <CommitInput
              inputMode="decimal"
              className={`${set.isBodyweight ? 'w-10' : 'w-14'} text-right text-base font-bold ${numBoxClass}`}
              value={String(set.weight)}
              onCommit={(t) => {
                const n = parseNum(t)
                if (n !== undefined) void commitAndCheckMax({ weight: n })
              }}
            />
            <span className="shrink-0 text-xs text-slate-400">{set.unit}</span>
            <CopyBtn
              label="前セットの RPE・レップ数をコピー"
              disabled={!prevSet}
              onClick={() =>
                prevSet && void updateSet(set.id, { rpe: prevSet.rpe, reps: prevSet.reps })
              }
            />
            <span className="shrink-0 text-[10px] text-slate-400">RPE</span>
            <CommitInput
              inputMode="decimal"
              className={`w-9 text-sm text-slate-500 dark:text-slate-400 ${numBoxClass}`}
              value={set.rpe != null ? String(set.rpe) : ''}
              placeholder="-"
              onCommit={(t) => {
                const n = parseNum(t)
                void updateSet(set.id, { rpe: n })
              }}
            />
            {set.rpe != null && (
              <ClearBtn
                label="RPE を削除"
                onClick={() => void updateSet(set.id, { rpe: undefined })}
              />
            )}
            <span className="shrink-0 text-xs text-slate-400">/</span>
            <CommitInput
              inputMode="numeric"
              className={`w-9 text-base font-bold ${numBoxClass}`}
              value={set.reps > 0 ? String(set.reps) : ''}
              placeholder="-"
              onCommit={(t) => {
                // 空欄 = 未実施(0 として保存し、表示は空欄・1RM 非表示)
                if (t.trim() === '') {
                  void updateSet(set.id, { reps: 0 })
                  return
                }
                const n = parseNum(t)
                if (n !== undefined) void commitAndCheckMax({ reps: Math.round(n) })
              }}
            />
            {set.reps > 0 && (
              <ClearBtn
                label="実績レップ数を削除"
                onClick={() => void updateSet(set.id, { reps: 0 })}
              />
            )}
            <span className="shrink-0 text-xs text-slate-400">回</span>
          </div>
          {/* メモ行(全幅で見やすく)と属性+1RM 行は分ける */}
          <div className="mt-0.5 flex items-center gap-1 pl-5">
            <CopyBtn
              label="前セットのコメントをコピー"
              disabled={!prevSet?.memo}
              onClick={() => prevSet?.memo && void updateSet(set.id, { memo: prevSet.memo })}
            />
            <CommitInput
              multiline
              className="min-w-0 flex-1 resize-none border-b border-slate-100 bg-transparent px-1 py-0.5 text-xs leading-snug dark:border-slate-700/60"
              value={set.memo ?? ''}
              placeholder="メモ"
              onCommit={(t) => void updateSet(set.id, { memo: t.trim() || undefined })}
            />
            {set.memo && (
              <ClearBtn
                label="メモを削除"
                onClick={() => void updateSet(set.id, { memo: undefined })}
              />
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 pl-5">
            <button
              type="button"
              title="ウォームアップ(週間集計・MAX 判定から除外)"
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                set.isWarmup
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/60 dark:text-orange-300'
                  : 'border border-slate-200 text-slate-400 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700'
              }`}
              onClick={() => void updateSet(set.id, { isWarmup: !set.isWarmup || undefined })}
            >
              W
            </button>
            <button
              type="button"
              title="自重(加重分を体重に上乗せして 1RM 換算)"
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                set.isBodyweight
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'border border-slate-200 text-slate-400 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700'
              }`}
              onClick={toggleBodyweight}
            >
              自
            </button>
            <div className="flex flex-wrap items-center gap-1">
              {/* 付いている属性: タップで外す */}
              {attrs.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 active:bg-sky-200 dark:bg-sky-900 dark:text-sky-300"
                  onClick={() => void toggleSetAttribute(set.id, a)}
                >
                  {a} ✕
                </button>
              ))}
              {/* 未付与のクイック属性: タップで付ける */}
              {quickAttrs
                .filter((q) => !attrs.includes(q))
                .map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
                    onClick={() => void toggleSetAttribute(set.id, q)}
                  >
                    {q}
                  </button>
                ))}
              <button
                type="button"
                aria-label="属性を選択"
                className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
                onClick={() => setAttrPickerOpen(true)}
              >
                ＋属性
              </button>
            </div>
            {oneRm > 0 && (
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                1RM {Math.round(oneRm * 10) / 10}kg
              </span>
            )}
          </div>
        </div>
      </SwipeToDelete>
      {attrPickerOpen && (
        <AttributePicker
          open
          current={attrs}
          onClose={() => setAttrPickerOpen(false)}
          onToggle={(name) => void toggleSetAttribute(set.id, name)}
        />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { useSetting } from '../../db/settings'
import { formatDateLabel, todayString } from '../../lib/date'
import { computeMaxRows, type BestEntry, type MaxRow } from '../../lib/maxStats'

const round1 = (v: number) => Math.round(v * 10) / 10

type SortKey = 'updatedDate' | 'lastDate' | 'oneRm'

/** 種目×タグごとの MAX 記録一覧。行タップで達成日・内訳の詳細を表示 */
export function MaxView() {
  const navigate = useNavigate()
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const bodyWeight = useSetting<number>('bodyWeight')
  const { exerciseName, tagName } = useMasters()
  const [selected, setSelected] = useState<MaxRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('updatedDate')
  const [query, setQuery] = useState('')

  // 達成日タップでその日の記録画面へ移動する(#7)
  const openRecord = (date: string) => {
    navigate(date === todayString() ? '/record' : `/record?date=${date}`)
  }

  const rows = useMemo(() => {
    const base = computeMaxRows(sets ?? [], bodyWeight)
    const q = query.trim()
    const filtered = q ? base.filter((r) => exerciseName(r.exerciseId).includes(q)) : base
    if (sortKey === 'oneRm') {
      return [...filtered].sort((a, b) => b.oneRm.value - a.oneRm.value)
    }
    const dateOf = (r: MaxRow) => (sortKey === 'updatedDate' ? r.updatedDate : r.lastDate)
    return [...filtered].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
  }, [sets, bodyWeight, sortKey, query, exerciseName])

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs ${
      active
        ? 'bg-sky-600 font-bold text-white'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    }`

  const detailRow = (label: string, entry: BestEntry, value: string) => (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs text-slate-400">{label}</span>
      <span className="tabular text-base font-bold">{value}</span>
      <span className="text-xs text-slate-400">
        ({round1(entry.load)}kg × {entry.reps}回)
      </span>
      <button
        type="button"
        className="ml-auto shrink-0 text-xs text-sky-600 dark:text-sky-400"
        onClick={() => {
          setSelected(null)
          openRecord(entry.date)
        }}
      >
        {formatDateLabel(entry.date)} ›
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-bold">👑 MAX 記録(種目×タグ)</h2>

        <input
          type="text"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder="種目名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            className={chipClass(sortKey === 'updatedDate')}
            onClick={() => setSortKey('updatedDate')}
          >
            最近更新順
          </button>
          <button
            type="button"
            className={chipClass(sortKey === 'lastDate')}
            onClick={() => setSortKey('lastDate')}
          >
            最近やった順
          </button>
          <button
            type="button"
            className={chipClass(sortKey === 'oneRm')}
            onClick={() => setSortKey('oneRm')}
          >
            推定1RM順
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            {query.trim() ? '該当する種目がありません' : 'まだ記録がありません'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li className="flex items-center gap-2 py-1 text-[10px] text-slate-400">
              <span className="min-w-0 flex-1">種目(タップで詳細)</span>
              <span className="w-14 shrink-0 text-right">最終日</span>
              <span className="w-16 shrink-0 text-right">推定1RM</span>
            </li>
            {rows.map((row) => (
              <li key={`${row.exerciseId}|${row.tagId}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-2 text-left active:bg-slate-50 dark:active:bg-slate-800"
                  onClick={() => setSelected(row)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {exerciseName(row.exerciseId)}
                    {tagName(row.tagId) && (
                      <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                        {tagName(row.tagId)}
                      </span>
                    )}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-slate-400">
                    {formatDateLabel(row.lastDate)}
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-sm font-bold text-sky-500">
                    {round1(row.oneRm.value)}kg
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[10px] text-slate-400">
          ウォームアップ・実績空欄は除外。自重セットは体重+加重で換算(体重未登録分は除外)
        </p>
      </section>

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`👑 ${exerciseName(selected.exerciseId)}${
            tagName(selected.tagId) ? ` / ${tagName(selected.tagId)}` : ''
          }`}
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {detailRow('重量ベスト', selected.load, `${round1(selected.load.value)}kg`)}
            {detailRow('回数ベスト', selected.reps, `${selected.reps.value}回`)}
            {detailRow('推定1RM', selected.oneRm, `${round1(selected.oneRm.value)}kg`)}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            日付はその値を最初に達成した日(最古)。タップするとその日の記録画面へ移動します。
            心当たりのない記録は、該当日の軽いセットに W(ウォームアップ)を付けると集計から外れます
          </p>
        </Modal>
      )}
    </div>
  )
}

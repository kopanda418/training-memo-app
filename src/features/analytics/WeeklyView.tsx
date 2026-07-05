import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMasters } from '../../db/hooks'
import { listSetsInRange } from '../../db/repository'
import { useSetting } from '../../db/settings'
import { NO_TAG } from '../../db/types'
import { todayString } from '../../lib/date'
import { addWeeks, formatWeekLabel, weekEnd, weekStart } from '../../lib/week'
import { bucketByWeekStart, computeWeeklyStats } from '../../lib/weeklyStats'

const BAR_WEEKS = 12

function formatVolume(v: number): string {
  return `${Math.round(v).toLocaleString()}kg`
}

/** 差分表示: 増=緑 / 減=赤 / 変化なし=グレー */
function Diff({ value, format }: { value: number; format?: (v: number) => string }) {
  const cls =
    value > 0
      ? 'text-emerald-500'
      : value < 0
        ? 'text-red-500'
        : 'text-slate-400 dark:text-slate-500'
  const text = `${value > 0 ? '+' : value < 0 ? '−' : '±'}${format ? format(Math.abs(value)) : Math.abs(value)}`
  return <span className={`text-[10px] font-bold ${cls}`}>{text}</span>
}

export function WeeklyView() {
  const today = todayString()
  const thisWeek = weekStart(today)
  // 基準週: 1 = 先週(‹ › で過去へ動かせる)
  const [baseOffset, setBaseOffset] = useState(1)
  const baseWeek = addWeeks(thisWeek, -baseOffset)

  const rangeStart = addWeeks(thisWeek, -(BAR_WEEKS - 1))
  const rangeEnd = weekEnd(thisWeek)
  const allSets = useLiveQuery(() => listSetsInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  const bodyWeight = useSetting<number>('bodyWeight')
  const { exerciseName, tags } = useMasters()

  const [tagFilter, setTagFilter] = useState<'all' | string>('all')
  const [barMetric, setBarMetric] = useState<'volume' | 'sets'>('volume')

  const filtered = useMemo(
    () => (allSets ?? []).filter((s) => tagFilter === 'all' || s.tagId === tagFilter),
    [allSets, tagFilter],
  )
  const byWeek = useMemo(() => bucketByWeekStart(filtered, weekStart), [filtered])

  const current = useMemo(
    () => computeWeeklyStats(byWeek.get(thisWeek) ?? [], bodyWeight),
    [byWeek, thisWeek, bodyWeight],
  )
  const base = useMemo(
    () => computeWeeklyStats(byWeek.get(baseWeek) ?? [], bodyWeight),
    [byWeek, baseWeek, bodyWeight],
  )

  // 種目別内訳(今週と基準週に登場する種目の和集合、量の大きい順)
  const rows = useMemo(() => {
    const ids = new Set([...current.byExercise.keys(), ...base.byExercise.keys()])
    return [...ids]
      .map((id) => {
        const cur = current.byExercise.get(id) ?? { sets: 0, volume: 0 }
        const ref = base.byExercise.get(id) ?? { sets: 0, volume: 0 }
        return { id, cur, ref }
      })
      .sort((a, b) => Math.max(b.cur.volume, b.ref.volume) - Math.max(a.cur.volume, a.ref.volume))
  }, [current, base])

  // 週次推移バー(過去 BAR_WEEKS 週)
  const bars = useMemo(() => {
    return [...Array(BAR_WEEKS)].map((_, i) => {
      const week = addWeeks(thisWeek, i - (BAR_WEEKS - 1))
      const stats = computeWeeklyStats(byWeek.get(week) ?? [], bodyWeight)
      return { week, value: barMetric === 'volume' ? stats.volume : stats.sets }
    })
  }, [byWeek, thisWeek, bodyWeight, barMetric])
  const barMax = Math.max(1, ...bars.map((b) => b.value))

  const excluded = current.excludedBodyweight + base.excludedBodyweight

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs ${
      active
        ? 'bg-sky-600 font-bold text-white'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    }`

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* タグフィルタ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          className={chipClass(tagFilter === 'all')}
          onClick={() => setTagFilter('all')}
        >
          すべて
        </button>
        <button
          type="button"
          className={chipClass(tagFilter === NO_TAG)}
          onClick={() => setTagFilter(NO_TAG)}
        >
          タグなし
        </button>
        {tags
          ?.filter((t) => !t.isArchived)
          .map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={chipClass(tagFilter === tag.id)}
              onClick={() => setTagFilter(tag.id)}
            >
              {tag.name}
            </button>
          ))}
      </div>

      {/* 基準週セレクタ */}
      <div className="flex items-center justify-between rounded-xl bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
        <button
          type="button"
          aria-label="さらに過去の週を基準にする"
          className="px-3 py-1 text-lg text-slate-500 active:text-sky-500"
          onClick={() => setBaseOffset((v) => v + 1)}
        >
          ‹
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          基準週:{' '}
          <span className="font-bold">{baseOffset === 1 ? '先週' : `${baseOffset}週前`}</span>(
          {formatWeekLabel(baseWeek)})
        </span>
        <button
          type="button"
          aria-label="基準週を新しい方へ"
          className="px-3 py-1 text-lg text-slate-500 active:text-sky-500 disabled:opacity-25"
          disabled={baseOffset <= 1}
          onClick={() => setBaseOffset((v) => Math.max(1, v - 1))}
        >
          ›
        </button>
      </div>

      {/* 今週サマリ */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">今週({formatWeekLabel(thisWeek)})</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800/60">
            <p className="text-[10px] text-slate-400">セット数</p>
            <p className="tabular text-xl font-bold">{current.sets}</p>
            <Diff value={current.sets - base.sets} />
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800/60">
            <p className="text-[10px] text-slate-400">ボリューム</p>
            <p className="tabular text-xl font-bold">{formatVolume(current.volume)}</p>
            <Diff value={current.volume - base.volume} format={formatVolume} />
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] text-slate-400">
          基準週: {base.sets}セット / {formatVolume(base.volume)}
          (ウォームアップ・実績空欄は集計対象外)
        </p>
        {excluded > 0 && (
          <p className="mt-1 text-center text-[10px] text-amber-500">
            体重未登録のため自重セット {excluded}{' '}
            件をボリュームから除外しています(設定で体重を登録すると計上されます)
          </p>
        )}
      </section>

      {/* 種目別内訳 */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">種目別(今週 vs 基準週)</h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">対象期間に記録がありません</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{exerciseName(row.id)}</span>
                <span className="w-20 shrink-0 text-right">
                  <span className="tabular text-sm font-bold">{row.cur.sets}</span>
                  <span className="text-[10px] text-slate-400">set</span>
                  <br />
                  <Diff value={row.cur.sets - row.ref.sets} />
                </span>
                <span className="w-24 shrink-0 text-right">
                  <span className="tabular text-sm font-bold">{formatVolume(row.cur.volume)}</span>
                  <br />
                  <Diff value={row.cur.volume - row.ref.volume} format={formatVolume} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 週次推移 */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">週次推移(過去{BAR_WEEKS}週)</h2>
          <div className="flex gap-1">
            <button
              type="button"
              className={chipClass(barMetric === 'volume')}
              onClick={() => setBarMetric('volume')}
            >
              ボリューム
            </button>
            <button
              type="button"
              className={chipClass(barMetric === 'sets')}
              onClick={() => setBarMetric('sets')}
            >
              セット数
            </button>
          </div>
        </div>
        <div className="mt-3 flex h-28 items-end gap-1">
          {bars.map((bar) => {
            const isCurrent = bar.week === thisWeek
            const isBase = bar.week === baseWeek
            return (
              <div key={bar.week} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                <div
                  title={`${formatWeekLabel(bar.week)}: ${
                    barMetric === 'volume' ? formatVolume(bar.value) : `${bar.value}セット`
                  }`}
                  className={`w-full rounded-t ${
                    isCurrent
                      ? 'bg-sky-500'
                      : isBase
                        ? 'bg-orange-400'
                        : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  style={{ height: `${Math.max(2, (bar.value / barMax) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{formatWeekLabel(bars[0].week)}</span>
          <span>
            <span className="font-bold text-orange-400">■</span>基準週{' '}
            <span className="font-bold text-sky-500">■</span>今週
          </span>
        </div>
      </section>
    </div>
  )
}

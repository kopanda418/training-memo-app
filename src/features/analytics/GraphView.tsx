import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { CommitInput } from '../../components/CommitInput'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { useSetting } from '../../db/settings'
import { NO_TAG, type WorkoutSet } from '../../db/types'
import { addDays, todayString } from '../../lib/date'
import { estimateOneRepMax } from '../../lib/oneRepMax'
import { effectiveLoad } from '../../lib/setFormat'
import { ExercisePicker } from '../record/ExercisePicker'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const METRICS = [
  { key: 'maxWeight', label: '最大重量' },
  { key: 'oneRm', label: '推定1RM' },
  { key: 'volume', label: '総負荷量' },
  { key: 'sets', label: 'セット数' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

const PERIODS = [
  { key: 30, label: '1ヶ月' },
  { key: 90, label: '3ヶ月' },
  { key: 180, label: '6ヶ月' },
  { key: 365, label: '1年' },
  { key: 0, label: '全期間' },
] as const

/** タグフィルタのモード。include = 選択タグのみ合算、exclude = 選択タグを除外 */
type FilterMode = 'include' | 'exclude'

/** 種目選択 → 全タグ合算で即表示 → タグフィルタチップで絞り込み */
export default function GraphView() {
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('include')
  const [selectedTagIds, setSelectedTagIds] = useState<ReadonlySet<string>>(new Set())
  const [metric, setMetric] = useState<MetricKey>('oneRm')
  const [periodDays, setPeriodDays] = useState<number>(0)
  const [yMin, setYMin] = useState<number | undefined>(undefined)
  const [yMax, setYMax] = useState<number | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const switchMode = (mode: FilterMode) => {
    setFilterMode(mode)
    setSelectedTagIds(new Set())
  }

  const { exerciseName, tags } = useMasters()
  const bodyWeight = useSetting<number>('bodyWeight')

  const sets = useLiveQuery<WorkoutSet[]>(
    () =>
      exerciseId ? db.sets.where('exerciseId').equals(exerciseId).toArray() : Promise.resolve([]),
    [exerciseId],
  )

  const usedTagIds = useMemo(() => new Set((sets ?? []).map((s) => s.tagId)), [sets])

  const points = useMemo(() => {
    const cutoff = periodDays > 0 ? addDays(todayString(), -periodDays) : ''
    const byDate = new Map<
      string,
      { maxWeight: number; oneRm: number; volume: number; sets: number }
    >()
    for (const s of sets ?? []) {
      if (s.isWarmup || s.reps <= 0) continue
      if (cutoff && s.date < cutoff) continue
      if (filterMode === 'include' && selectedTagIds.size > 0 && !selectedTagIds.has(s.tagId))
        continue
      if (filterMode === 'exclude' && selectedTagIds.has(s.tagId)) continue
      const load = effectiveLoad(s, bodyWeight)
      if (load === undefined) continue
      let p = byDate.get(s.date)
      if (!p) {
        p = { maxWeight: 0, oneRm: 0, volume: 0, sets: 0 }
        byDate.set(s.date, p)
      }
      p.maxWeight = Math.max(p.maxWeight, load)
      p.oneRm = Math.max(p.oneRm, Math.round(estimateOneRepMax(load, s.reps) * 10) / 10)
      p.volume += load * s.reps
      p.sets++
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [sets, bodyWeight, periodDays, filterMode, selectedTagIds])

  const metricLabel = METRICS.find((m) => m.key === metric)!.label
  const chartData = {
    labels: points.map(([date]) => {
      const [, m, d] = date.split('-').map(Number)
      return `${m}/${d}`
    }),
    datasets: [
      {
        label: metricLabel,
        data: points.map(([, p]) => p[metric]),
        borderColor: '#0ea5e9',
        backgroundColor: '#0ea5e9',
        pointRadius: 3,
        tension: 0.2,
      },
    ],
  }

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs ${
      active
        ? 'bg-sky-600 font-bold text-white'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    }`

  const tagChipClass = (tagId: string) => {
    const selected = selectedTagIds.has(tagId)
    if (!selected)
      return 'shrink-0 rounded-full px-3 py-1.5 text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    if (filterMode === 'include')
      return 'shrink-0 rounded-full px-3 py-1.5 text-xs bg-sky-600 font-bold text-white'
    return 'shrink-0 rounded-full px-3 py-1.5 text-xs bg-rose-500 font-bold text-white'
  }

  const tagFilterSummary = () => {
    if (selectedTagIds.size === 0) return null
    const n = selectedTagIds.size
    return filterMode === 'include' ? `${n}タグの記録を合算表示` : `${n}タグを除外して表示`
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700"
        onClick={() => setPickerOpen(true)}
      >
        {exerciseId ? exerciseName(exerciseId) : '種目を選択'}
      </button>

      {exerciseId && (
        <>
          {/* タグフィルタ: モード切替 + 複数選択 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    filterMode === 'include'
                      ? 'bg-white text-slate-900 shadow dark:bg-slate-600 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  onClick={() => switchMode('include')}
                >
                  タグを含める
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    filterMode === 'exclude'
                      ? 'bg-white text-slate-900 shadow dark:bg-slate-600 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  onClick={() => switchMode('exclude')}
                >
                  タグを除外
                </button>
              </div>
              {selectedTagIds.size > 0 && (
                <button
                  type="button"
                  className="text-xs text-slate-400 underline"
                  onClick={() => setSelectedTagIds(new Set())}
                >
                  リセット
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {filterMode === 'include' && (
                <button
                  type="button"
                  className={chipClass(selectedTagIds.size === 0)}
                  onClick={() => setSelectedTagIds(new Set())}
                >
                  すべて
                </button>
              )}
              {usedTagIds.has(NO_TAG) && (
                <button
                  type="button"
                  className={tagChipClass(NO_TAG)}
                  onClick={() => toggleTag(NO_TAG)}
                >
                  タグなし
                </button>
              )}
              {tags
                ?.filter((t) => usedTagIds.has(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={tagChipClass(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
            </div>

            {tagFilterSummary() && <p className="text-xs text-slate-400">{tagFilterSummary()}</p>}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={chipClass(metric === m.key)}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={chipClass(periodDays === p.key)}
                onClick={() => setPeriodDays(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}

      {exerciseId && points.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Line
            data={chartData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: '#33415555' } },
                y: {
                  ticks: { color: '#94a3b8' },
                  grid: { color: '#33415555' },
                  beginAtZero: metric === 'sets' || metric === 'volume',
                  min: yMin,
                  max: yMax,
                },
              },
            }}
          />
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-400">
            縦軸
            <CommitInput
              inputMode="decimal"
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right dark:border-slate-700"
              value={yMin != null ? String(yMin) : ''}
              placeholder="下限:自動"
              onCommit={(t) => {
                const n = Number(t)
                setYMin(t.trim() !== '' && Number.isFinite(n) ? n : undefined)
              }}
            />
            〜
            <CommitInput
              inputMode="decimal"
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right dark:border-slate-700"
              value={yMax != null ? String(yMax) : ''}
              placeholder="上限:自動"
              onCommit={(t) => {
                const n = Number(t)
                setYMax(t.trim() !== '' && Number.isFinite(n) ? n : undefined)
              }}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-slate-400">
            ウォームアップ・実績空欄は除外。自重セットは体重+加重で換算(体重未登録分は除外)
          </p>
        </section>
      )}
      {exerciseId && sets !== undefined && points.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">この条件の記録がありません</p>
      )}

      {pickerOpen && (
        <ExercisePicker
          open
          withTagStep={false}
          onClose={() => setPickerOpen(false)}
          onDone={(id) => {
            setExerciseId(id)
            setFilterMode('include')
            setSelectedTagIds(new Set())
          }}
        />
      )}
    </div>
  )
}

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
import { useMasters } from '../../db/hooks'
import { listHistory } from '../../db/repository'
import { useSetting } from '../../db/settings'
import { NO_TAG } from '../../db/types'
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

/** 種目×タグ別の折れ線グラフ(遅延ロードされるので default export) */
export default function GraphView() {
  const [target, setTarget] = useState<{ exerciseId: string; tagId: string } | null>(null)
  const [metric, setMetric] = useState<MetricKey>('oneRm')
  const [pickerOpen, setPickerOpen] = useState(false)

  const { exerciseName, tagName } = useMasters()
  const bodyWeight = useSetting<number>('bodyWeight')
  const history = useLiveQuery(
    () => (target ? listHistory(target.exerciseId, target.tagId) : Promise.resolve([])),
    [target?.exerciseId, target?.tagId],
  )

  // 日付ごとに指標を計算(ウォームアップ・実績空欄・換算不能な自重は除外)
  const points = useMemo(() => {
    const byDate = new Map<
      string,
      { maxWeight: number; oneRm: number; volume: number; sets: number }
    >()
    for (const s of history ?? []) {
      if (s.isWarmup || s.reps <= 0) continue
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
  }, [history, bodyWeight])

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

  return (
    <div className="flex flex-col gap-3 p-3">
      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700"
        onClick={() => setPickerOpen(true)}
      >
        {target
          ? `${exerciseName(target.exerciseId)}${tagName(target.tagId) ? ` / ${tagName(target.tagId)}` : ''}`
          : '種目×タグを選択'}
      </button>

      {target && (
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
      )}

      {target && points.length > 0 && (
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
                },
              },
            }}
          />
          <p className="mt-1 text-center text-[10px] text-slate-400">
            ウォームアップ・実績空欄は除外。自重セットは体重+加重で換算(体重未登録分は除外)
          </p>
        </section>
      )}
      {target && history !== undefined && points.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">この種目×タグの記録がありません</p>
      )}

      {pickerOpen && (
        <ExercisePicker
          open
          onClose={() => setPickerOpen(false)}
          onDone={(exerciseId, tagId) => setTarget({ exerciseId, tagId: tagId || NO_TAG })}
        />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import {
  CategoryScale,
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { listBodyWeights } from '../../db/bodyWeight'
import { addDays, formatDateLabel, todayString } from '../../lib/date'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

const PERIODS = [
  { key: 30, label: '1ヶ月' },
  { key: 90, label: '3ヶ月' },
  { key: 180, label: '6ヶ月' },
  { key: 365, label: '1年' },
  { key: 0, label: '全期間' },
] as const

const fmt = (n: number) => n.toFixed(2)

/** 体重の推移グラフ(ADR-017)。入力は体調画面 */
export default function BodyWeightView() {
  const navigate = useNavigate()
  const entries = useLiveQuery(listBodyWeights, [])
  const [periodDays, setPeriodDays] = useState<number>(90)

  const points = useMemo(() => {
    const from = periodDays > 0 ? addDays(todayString(), -periodDays) : ''
    return (entries ?? []).filter((e) => e.date >= from)
  }, [entries, periodDays])

  const latest = points.at(-1)
  const first = points[0]
  const diff = latest && first ? latest.weight - first.weight : 0
  const weights = points.map((p) => p.weight)

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs ${
      active
        ? 'bg-sky-600 font-bold text-white'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
    }`

  return (
    <div className="flex flex-col gap-3 p-3">
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

      {latest && (
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              最新({formatDateLabel(latest.date)})
            </p>
            <p className="text-base font-bold tabular">{fmt(latest.weight)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">期間の増減</p>
            <p className="text-base font-bold tabular">
              {diff > 0 ? '+' : ''}
              {fmt(diff)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">最小〜最大</p>
            <p className="text-sm font-bold tabular">
              {fmt(Math.min(...weights))}〜{fmt(Math.max(...weights))}
            </p>
          </div>
        </section>
      )}

      {points.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Line
            data={{
              labels: points.map((p) => {
                const [, m, d] = p.date.split('-').map(Number)
                return `${m}/${d}`
              }),
              datasets: [
                {
                  label: '体重(kg)',
                  data: weights,
                  borderColor: '#0ea5e9',
                  backgroundColor: '#0ea5e9',
                  pointRadius: 3,
                  tension: 0.2,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => `${fmt(Number(c.parsed.y))} kg` } },
              },
              scales: {
                x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: '#33415555' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#33415555' } },
              },
            }}
          />
          <p className="mt-1 text-center text-[10px] text-slate-400">単位 kg</p>
        </section>
      )}
      {entries !== undefined && points.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          {entries.length === 0 ? '体重の記録がまだありません' : 'この期間の記録がありません'}
        </p>
      )}

      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700"
        onClick={() => navigate('/condition')}
      >
        今日の体重を入力する ›
      </button>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  getCondition,
  listOngoingPains,
  listPainsByDate,
  painKey,
  savePain,
  setConditionScore,
  type PainInput,
} from '../../db/condition'
import { useMasters } from '../../db/hooks'
import type { PainRecord } from '../../db/types'
import { addDays, formatDateLabel, todayString } from '../../lib/date'
import { painTitle } from '../../lib/painRegions'
import { describePain } from '../../lib/painSummary'
import { BodyMap, type BodyMapSelection, type BodyView } from './BodyMap'
import { ScaleButtons, goodnessColor, painColor } from './controls'
import { PainEditor } from './PainEditor'

/** 前回の記録を引き継いで今日の下書きを作る(関連種目・メモ・始まり方は日ごとの情報なので引き継がない) */
function carryOver(p: PainRecord, date: string, intensity = p.intensity): PainInput {
  return {
    date,
    area: p.area,
    side: p.side,
    regionIds: p.regionIds,
    intensity,
    qualities: p.qualities,
    timings: p.timings,
    movements: p.movements,
    exerciseIds: [],
  }
}

function PainBadge({ n }: { n: number }) {
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold text-white tabular"
      style={{ backgroundColor: painColor(n) }}
    >
      {n}
    </span>
  )
}

/** 体調・やる気(1〜10)と痛みの記録画面(ADR-014)。記録画面の要約ボタンから開く */
export function ConditionPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromRecord = (location.state as { from?: string } | null)?.from === 'record'
  const today = todayString()
  const date = params.get('date') ?? today
  const setDate = (d: string) =>
    setParams({ date: d }, { replace: true, state: location.state as unknown })

  const condition = useLiveQuery(() => getCondition(date), [date])
  const pains = useLiveQuery(() => listPainsByDate(date), [date])
  const ongoing = useLiveQuery(() => listOngoingPains(date), [date])
  const { exerciseName } = useMasters()

  const [view, setView] = useState<BodyView>('front')
  const [editing, setEditing] = useState<PainInput | null>(null)

  const marked = useMemo(
    () => new Map((pains ?? []).map((p) => [painKey(p), p.intensity])),
    [pains],
  )

  const handleMapSelect = ({ area, side, regionId }: BodyMapSelection) => {
    const existing = pains?.find((p) => p.area === area && p.side === side)
    if (existing) {
      setEditing(existing)
      return
    }
    // 続いている痛みと同じ場所なら前回内容を引き継ぐ
    const prev = ongoing?.find((p) => p.area === area && p.side === side)
    setEditing(
      prev
        ? carryOver(prev, date)
        : {
            date,
            area,
            side,
            regionIds: regionId ? [regionId] : [],
            intensity: 3,
            qualities: [],
            timings: [],
            movements: [],
            exerciseIds: [],
          },
    )
  }

  const goBack = () => {
    if (fromRecord) navigate(-1)
    else navigate(date === today ? '/record' : `/record?date=${date}`)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            type="button"
            className="shrink-0 px-1 text-sm text-sky-600 dark:text-sky-400"
            onClick={goBack}
          >
            ‹ 記録
          </button>
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              aria-label="前の日"
              className="px-3 py-1 text-xl text-slate-500 active:text-sky-600"
              onClick={() => setDate(addDays(date, -1))}
            >
              ‹
            </button>
            <h1 className="text-base font-bold">{formatDateLabel(date)} の体調</h1>
            <button
              type="button"
              aria-label="次の日"
              className="px-3 py-1 text-xl text-slate-500 active:text-sky-600"
              onClick={() => setDate(addDays(date, 1))}
            >
              ›
            </button>
          </div>
          <span className="w-12 shrink-0" />
        </div>
      </header>

      <div className="flex flex-col gap-5 p-3">
        <section className="flex flex-col gap-3">
          {(
            [
              ['condition', '体調', '1=最悪 〜 10=絶好調'],
              ['motivation', 'やる気', '1=全くない 〜 10=最高'],
            ] as const
          ).map(([field, label, hint]) => (
            <div key={field}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h2 className="text-sm font-bold">
                  {label}
                  {condition?.[field] !== undefined && (
                    <span className="ml-2 text-base tabular">{condition[field]}</span>
                  )}
                </h2>
                <span className="text-xs text-slate-400">{hint}</span>
              </div>
              <ScaleButtons
                min={1}
                max={10}
                clearable
                value={condition?.[field]}
                colorOf={goodnessColor}
                onChange={(v) => void setConditionScore(date, field, v)}
              />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold">痛み</h2>
            <button
              type="button"
              className="text-xs text-sky-600 dark:text-sky-400"
              onClick={() => navigate('/condition/pain')}
            >
              📈 痛みの経過を見る ›
            </button>
          </div>

          {ongoing && ongoing.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-2 dark:bg-amber-950/40">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                続いている痛み(直近 2 週間)
              </p>
              {ongoing.map((p) => (
                <div key={painKey(p)} className="flex items-center gap-2 text-sm">
                  <PainBadge n={p.intensity} />
                  <span className="min-w-0 flex-1 truncate">
                    {painTitle(p.area, p.side)}
                    <span className="ml-1 text-xs text-slate-500">({formatDateLabel(p.date)})</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-bold text-white active:bg-amber-600"
                    onClick={() => setEditing(carryOver(p, date))}
                  >
                    今日も痛い
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 active:bg-emerald-50 dark:text-emerald-400 dark:active:bg-emerald-950"
                    onClick={() => void savePain(carryOver(p, date, 0))}
                  >
                    痛くない
                  </button>
                </div>
              ))}
            </div>
          )}

          {pains?.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
              onClick={() => setEditing(p)}
            >
              <PainBadge n={p.intensity} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{painTitle(p.area, p.side)}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {describePain(p, exerciseName) || '詳細なし(タップで編集)'}
                </span>
              </span>
            </button>
          ))}

          <div className="mt-1 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">痛む場所をタップして記録</p>
              <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs dark:border-slate-600">
                {(
                  [
                    ['front', '正面'],
                    ['back', '背面'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={`px-3 py-1 ${
                      view === v
                        ? 'bg-sky-600 font-bold text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setView(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <BodyMap view={view} marked={marked} onSelect={handleMapSelect} />
          </div>
        </section>
      </div>

      {editing && (
        <PainEditor
          key={editing.id ?? painKey(editing)}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { showToast } from '../../components/Toast'
import { listPainGroups, painKey, type PainGroup } from '../../db/condition'
import { useMasters } from '../../db/hooks'
import { formatDateLabel } from '../../lib/date'
import { onsetLabel, painTitle } from '../../lib/painRegions'
import { buildPainSummary, describePain } from '../../lib/painSummary'
import { painColor } from './controls'

/** 強さの推移(直近 30 回分の棒グラフ。高さ = 強さ) */
function IntensityBars({ group }: { group: PainGroup }) {
  const recent = group.records.slice(-30)
  return (
    <div className="flex h-10 items-end gap-0.5" aria-label="強さの推移">
      {recent.map((p) => (
        <div
          key={p.id}
          className="min-w-[3px] flex-1 rounded-t-sm"
          title={`${p.date} 強さ${p.intensity}`}
          style={{
            height: `${Math.max(p.intensity * 10, 6)}%`,
            backgroundColor: painColor(p.intensity),
          }}
        />
      ))}
    </div>
  )
}

function GroupCard({ group }: { group: PainGroup }) {
  const [open, setOpen] = useState(false)
  const { exerciseName } = useMasters()
  const navigate = useNavigate()
  const first = group.records[0]
  const last = group.records[group.records.length - 1]
  const onset = group.records.find((p) => p.onset)?.onset

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildPainSummary(group.records, exerciseName))
      showToast('受診用の要約をコピーしました')
    } catch {
      showToast('コピーできませんでした')
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <button type="button" className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">{painTitle(group.area, group.side)}</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            最新 <span className="font-bold tabular">{last.intensity}</span> / 10
          </span>
        </div>
        <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">
          {formatDateLabel(first.date)}〜{formatDateLabel(last.date)}・{group.records.length}回
          {onset && `・始まり方: ${onsetLabel(onset)}`}
        </p>
        <IntensityBars group={group} />
        <p className="mt-1 text-right text-xs text-sky-600 dark:text-sky-400">
          {open ? '閉じる ▲' : '記録一覧 ▼'}
        </p>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          {[...group.records].reverse().map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex items-start gap-2 rounded-lg px-1 py-1 text-left active:bg-slate-100 dark:active:bg-slate-800"
              onClick={() => navigate(`/condition?date=${p.date}`)}
            >
              <span className="w-20 shrink-0 text-xs text-sky-600 dark:text-sky-400">
                {formatDateLabel(p.date)}
              </span>
              <span
                className="shrink-0 rounded px-1 text-xs font-bold text-white tabular"
                style={{ backgroundColor: painColor(p.intensity) }}
              >
                {p.intensity}
              </span>
              <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
                {describePain(p, exerciseName)}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="mt-2 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 active:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:active:bg-slate-800"
            onClick={() => void copySummary()}
          >
            📋 受診用にテキストでコピー
          </button>
        </div>
      )}
    </section>
  )
}

/** 痛みの経過(部位×左右ごと)。受診時に医師へ見せる要約をコピーできる */
export function PainHistoryPage() {
  const navigate = useNavigate()
  const groups = useLiveQuery(() => listPainGroups(), [])

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex items-center gap-2">
        <button
          type="button"
          className="text-sm text-sky-600 dark:text-sky-400"
          onClick={() => navigate(-1)}
        >
          ‹ 戻る
        </button>
        <h1 className="text-base font-bold">痛みの経過</h1>
      </header>
      {groups?.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">痛みの記録はまだありません</p>
      )}
      {groups?.map((g) => (
        <GroupCard key={painKey(g)} group={g} />
      ))}
    </div>
  )
}
